import {
  BRAND_CATEGORIES,
  UPLOAD_POLICIES,
  type UploadTarget,
  type BrandAsset,
  type BrandCategory,
} from "@repo/worker-api/contracts";
import { CUSTOMER } from "@repo/worker-api/endpoints";
import { type Context, Hono } from "hono";
import { z } from "zod";

import type { IdentityEnv } from "#/identity/gates";
import { answer } from "#/lib/endpoint";
import { DomainError } from "#/lib/errors";
import { parsePositiveInt } from "#/lib/pagination";
import type { JsonRecord } from "#/lib/records";
import {
  assetReference,
  deleteAssets,
  deleteBrandAsset,
  listAssets,
  storeAsset,
  type AssetRecord,
} from "#/library/assets";

const brandCategorySchema = z.enum(BRAND_CATEGORIES);

const OTHER_CATEGORY: BrandCategory = "other";

const brandAssetMetadataSchema = z.object({
  category: z.string().optional(),
  originalName: z.string().nullish(),
});

const toBrandAsset = (row: AssetRecord): BrandAsset => {
  const metadata = brandAssetMetadataSchema.safeParse(row.metadata).data;

  return {
    category: brandCategorySchema.safeParse(metadata?.category).data ?? OTHER_CATEGORY,
    createdAt: row.createdAt,
    id: row.id,
    mimeType: row.mime,
    name: metadata?.originalName ?? null,
    size: row.bytes,
    url: assetReference(row.id),
  };
};

const readForm = async (c: Context<IdentityEnv>): Promise<FormData> => {
  try {
    return await c.req.formData();
  } catch {
    throw new DomainError(400, "Invalid multipart body");
  }
};

const readImageUpload = async (
  c: Context<IdentityEnv>,
  target: UploadTarget,
): Promise<{ file: File; form: FormData }> => {
  const policy = UPLOAD_POLICIES[target];
  const form = await readForm(c);
  const file = form.get("file");

  if (!(file instanceof File)) {
    throw new DomainError(400, "Missing 'file' field");
  }

  if (!policy.mimeTypes.some((mimeType) => mimeType === file.type)) {
    throw new DomainError(415, `Unsupported mime '${file.type}'`);
  }

  if (file.size > policy.maxBytes) {
    throw new DomainError(413, `File too large (max ${policy.maxBytes} bytes)`);
  }

  return { file, form };
};

const storeImageUpload = async (
  c: Context<IdentityEnv>,
  file: File,
  kind: "brand_asset" | "user_upload",
  metadata: JsonRecord = {},
): Promise<AssetRecord> =>
  storeAsset(c.env, c.var.db, {
    bytes: new Uint8Array(await file.arrayBuffer()),
    companyId: c.var.session.companyId,
    kind,
    metadata: { originalName: file.name || null, ...metadata },
    mime: file.type,
    visibility: "customer",
  });

/** Mounted by the customer router, which gates it. */
const libraryRoutes = new Hono<IdentityEnv>();

answer(libraryRoutes, CUSTOMER.assets, async (c, { query }) => {
  const rows = await listAssets(c.var.db, c.var.session.companyId, {
    limit: parsePositiveInt(query.limit, 100, 200),
    visibility: "customer",
  });

  return {
    items: rows.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      kind: row.kind,
      mimeType: row.mime,
      name: row.name,
      size: row.bytes,
      url: assetReference(row.id),
    })),
  };
});

answer(libraryRoutes, CUSTOMER.deleteAssets, async (c, { body }) => ({
  deleted: await deleteAssets(c.env, c.var.db, c.var.session.companyId, {
    ids: body.ids,
    visibility: "customer",
  }),
}));

answer(libraryRoutes, CUSTOMER.uploadChatFile, async (c) => {
  const { file } = await readImageUpload(c, "chat");
  const asset = await storeImageUpload(c, file, "user_upload");

  return {
    assetId: asset.id,
    mimeType: asset.mime,
    size: asset.bytes,
    url: assetReference(asset.id),
  };
});

answer(libraryRoutes, CUSTOMER.brandAssets, async (c) => {
  const rows = await listAssets(c.var.db, c.var.session.companyId, {
    kind: "brand_asset",
    limit: 200,
  });

  return { items: rows.map(toBrandAsset) };
});

answer(libraryRoutes, CUSTOMER.uploadBrandAsset, async (c) => {
  const { file, form } = await readImageUpload(c, "brand");

  const asset = await storeImageUpload(c, file, "brand_asset", {
    category: brandCategorySchema.safeParse(form.get("category")).data ?? OTHER_CATEGORY,
  });

  return { asset: toBrandAsset(asset) };
});

answer(libraryRoutes, CUSTOMER.deleteBrandAsset, async (c, { params }) => {
  await deleteBrandAsset(c.env, c.var.db, c.var.session.companyId, params.id);

  return { ok: true };
});

export { libraryRoutes };
