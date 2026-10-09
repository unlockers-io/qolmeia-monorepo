import type { Asset, AssetKind, AssetVisibility } from "@repo/db/worker";

import type { Db } from "#/lib/db";
import { fetchAsset, uploadAsset } from "#/lib/r2";
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

type PersistAssetInput = {
  bytes: Uint8Array;
  companyId: string;
  fallbackExt?: string;
  kind: AssetKind;
  metadata: JsonRecord;
  mime: string;
  uploadMetadata: Record<string, string>;
  visibility: AssetVisibility;
};

const persistAsset = async (
  env: Pick<Env, "ASSETS">,
  db: Db,
  input: PersistAssetInput,
): Promise<{ assetId: string }> => {
  const sha256 = await sha256Hex(input.bytes);
  const ext = EXTENSION_BY_MIME.get(input.mime) ?? input.fallbackExt ?? "bin";
  const folder = input.kind === "brand_asset" ? `${input.visibility}/brand` : input.visibility;
  const r2Key = `org_${input.companyId}/${folder}/${sha256}.${ext}`;
  await uploadAsset(env, {
    bytes: input.bytes,
    key: r2Key,
    metadata: input.uploadMetadata,
    mime: input.mime,
  });
  const asset = await db.asset.upsert({
    create: {
      bytes: input.bytes.length,
      companyId: input.companyId,
      id: crypto.randomUUID(),
      kind: input.kind,
      metadata: input.metadata,
      mime: input.mime,
      r2Key,
      sha256,
      visibility: input.visibility,
    },
    select: { id: true },
    update: {},
    where: { companyId_sha256: { companyId: input.companyId, sha256 } },
  });
  return { assetId: asset.id };
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

const listBrandReferences = (db: Db, companyId: string, limit: number) =>
  db.asset.findMany({
    orderBy: { createdAt: "desc" },
    select: { mime: true, r2Key: true },
    take: limit,
    where: { companyId, kind: "brand_asset", mime: { not: "image/svg+xml" } },
  });

const getAssetAccess = (db: Db, assetId: string) =>
  db.asset.findUnique({ select: { mime: true, r2Key: true }, where: { id: assetId } });

const readAssetText = async (
  env: Pick<Env, "ASSETS">,
  db: Db,
  companyId: string,
  assetId: string,
): Promise<{ content: string; name: string } | null> => {
  const row = await db.asset.findFirst({ where: { companyId, id: assetId } });
  if (!row || !TEXT_MIME_PREFIXES.some((prefix) => row.mime.startsWith(prefix))) {
    return null;
  }
  const object = await fetchAsset(env, row.r2Key);
  if (!object) {
    return null;
  }
  return { content: await object.text(), name: toAssetRecord(row).name };
};

const deleteAssets = async (
  env: Pick<Env, "ASSETS">,
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
  await db.asset.deleteMany({ where: { companyId, id: { in: rows.map((row) => row.id) } } });
  await Promise.allSettled(rows.map((row) => env.ASSETS.delete(row.r2Key)));
  return rows.length;
};

export {
  deleteAssets,
  getAssetAccess,
  listAssets,
  listBrandReferences,
  persistAsset,
  readAssetText,
};
export type { AssetRecord, AssetSummary };
