import type { Asset, AssetKind, AssetVisibility, Prisma } from "@repo/db/worker";

import type { ValidatedSession } from "#/lib/auth";
import type { Db } from "#/lib/db";
import { toRecordOrNull, type JsonRecord } from "#/lib/records";

type AssetSummary = {
  bytes: number;
  createdAt: number;
  id: string;
  kind: AssetKind;
  mime: string;
  name: string;
  visibility: AssetVisibility;
};

type AssetRecord = AssetSummary & { metadata: JsonRecord | null };

type LibraryEnv = Pick<Env, "ASSETS">;

const EXTENSION_BY_MIME = new Map(
  Object.entries({
    "application/json": "json",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
    "text/csv": "csv",
    "text/markdown": "md",
    "text/plain": "txt",
  }),
);

const TEXT_MIME_PREFIXES = ["text/", "application/json"];

const assetReference = (assetId: string): string => `/assets/${assetId}`;

const assetName = (metadata: JsonRecord | null, id: string, kind: string): string => {
  const name = typeof metadata?.name === "string" ? metadata.name : "";
  const originalName = typeof metadata?.originalName === "string" ? metadata.originalName : "";
  return name || originalName || `${kind} ${id.slice(0, 6)}`;
};

const toAssetRecord = (row: Asset): AssetRecord => {
  const metadata = toRecordOrNull(row.metadata);
  return {
    bytes: row.bytes,
    createdAt: row.createdAt.getTime(),
    id: row.id,
    kind: row.kind,
    metadata,
    mime: row.mime,
    name: assetName(metadata, row.id, row.kind),
    visibility: row.visibility,
  };
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const promoteAssets = async (
  db: Db,
  companyId: string,
  assetIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<{ id: string; mime: string }>> => {
  const where = { companyId, id: { in: [...assetIds] } };
  await db.asset.updateMany({ data: { visibility: "customer" }, where });
  return db.asset.findMany({ select: { id: true, mime: true }, where });
};

type StoreAssetInput = {
  bytes: Uint8Array;
  companyId: string;
  kind: AssetKind;
  metadata: JsonRecord;
  mime: string;
  visibility: AssetVisibility;
};

const storeAsset = async (
  env: LibraryEnv,
  db: Db,
  input: StoreAssetInput,
): Promise<{ assetId: string }> => {
  const { companyId } = input;
  const sha256 = await sha256Hex(input.bytes);
  const existing = await db.asset.findUnique({
    select: { id: true, visibility: true },
    where: { companyId_sha256: { companyId, sha256 } },
  });
  if (existing) {
    if (existing.visibility === "agent" && input.visibility === "customer") {
      await promoteAssets(db, companyId, [existing.id]);
    }
    return { assetId: existing.id };
  }
  const id = crypto.randomUUID();
  const r2Key = `org_${companyId}/${id}.${EXTENSION_BY_MIME.get(input.mime) ?? "bin"}`;
  await env.ASSETS.put(r2Key, input.bytes, { httpMetadata: { contentType: input.mime } });
  try {
    await db.asset.create({
      data: {
        bytes: input.bytes.length,
        companyId,
        id,
        kind: input.kind,
        metadata: input.metadata,
        mime: input.mime,
        r2Key,
        sha256,
        visibility: input.visibility,
      },
    });
  } catch (error) {
    await env.ASSETS.delete(r2Key);
    throw error;
  }
  return { assetId: id };
};

const listAssets = async (
  db: Db,
  companyId: string,
  filter: { kind?: AssetKind; limit?: number; visibility?: AssetVisibility } = {},
): Promise<ReadonlyArray<AssetRecord>> => {
  const rows = await db.asset.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? 100, 200),
    where: { companyId, kind: filter.kind, visibility: filter.visibility },
  });
  return rows.map(toAssetRecord);
};

const readerScope = ({
  companyId,
  role,
}: Pick<ValidatedSession, "companyId" | "role">): Prisma.AssetWhereInput =>
  role === "CUSTOMER" ? { companyId, visibility: "customer" } : {};

const openAsset = async (
  env: LibraryEnv,
  db: Db,
  assetId: string,
  reader: Pick<ValidatedSession, "companyId" | "role">,
): Promise<{ body: ReadableStream; mime: string } | null> => {
  const row = await db.asset.findFirst({
    select: { mime: true, r2Key: true },
    where: { id: assetId, ...readerScope(reader) },
  });
  const object = row ? await env.ASSETS.get(row.r2Key) : null;
  return row && object ? { body: object.body, mime: row.mime } : null;
};

const readAssetText = async (
  env: LibraryEnv,
  db: Db,
  companyId: string,
  assetId: string,
): Promise<{ content: string; name: string } | null> => {
  const row = await db.asset.findFirst({ where: { companyId, id: assetId } });
  if (!row || !TEXT_MIME_PREFIXES.some((prefix) => row.mime.startsWith(prefix))) {
    return null;
  }
  const object = await env.ASSETS.get(row.r2Key);
  return object ? { content: await object.text(), name: toAssetRecord(row).name } : null;
};

const readBrandReferences = async (
  env: LibraryEnv,
  db: Db,
  companyId: string,
  limit: number,
): Promise<ReadonlyArray<{ bytes: Uint8Array; mime: string }>> => {
  const rows = await db.asset.findMany({
    orderBy: { createdAt: "desc" },
    select: { mime: true, r2Key: true },
    take: limit,
    where: { companyId, kind: "brand_asset", mime: { not: "image/svg+xml" } },
  });
  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      const object = await env.ASSETS.get(row.r2Key);
      return object ? { bytes: new Uint8Array(await object.arrayBuffer()), mime: row.mime } : null;
    }),
  );
  return settled.flatMap((result) =>
    result.status === "fulfilled" && result.value !== null ? [result.value] : [],
  );
};

const deleteAssets = async (
  env: LibraryEnv,
  db: Db,
  companyId: string,
  where: { ids: ReadonlyArray<string>; kind?: AssetKind; visibility?: AssetVisibility },
): Promise<number> => {
  const rows = await db.asset.findMany({
    select: { id: true, r2Key: true },
    where: {
      companyId,
      id: { in: [...where.ids] },
      kind: where.kind,
      visibility: where.visibility,
    },
  });
  if (rows.length === 0) {
    return 0;
  }
  await env.ASSETS.delete(rows.map(({ r2Key }) => r2Key));
  await db.asset.deleteMany({ where: { companyId, id: { in: rows.map(({ id }) => id) } } });
  return rows.length;
};

export {
  assetReference,
  deleteAssets,
  listAssets,
  openAsset,
  promoteAssets,
  readAssetText,
  readBrandReferences,
  storeAsset,
};
export type { AssetRecord, AssetSummary };
