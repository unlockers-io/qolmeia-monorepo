import { Hono } from "hono";
import { z } from "zod";

import type { ValidatedSession } from "#/lib/auth";
import type { Db, DbVariables } from "#/lib/db";
import { parsePositiveInt } from "#/lib/pagination";
import type { JsonRecord } from "#/lib/records";
import { assetReference, deleteAssets, listAssets, storeAsset } from "#/library/assets";

type Vars = DbVariables & { session: ValidatedSession };

const meAssetsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

meAssetsRoutes.get("/assets", async (c) => {
  const { companyId } = c.get("session");
  const limit = parsePositiveInt(c.req.query("limit"), 100, 200);
  const results = await listAssets(c.var.db, companyId, { limit, visibility: "customer" });

  const items = results.map((row) => ({
    createdAt: new Date(row.createdAt).toISOString(),
    id: row.id,
    kind: row.kind,
    metadata: row.metadata,
    mimeType: row.mime,
    name: row.name,
    size: row.bytes,
    url: assetReference(row.id),
  }));

  return c.json({ items, nextCursor: null });
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

const persistImageAsset = async (
  env: Env,
  db: Db,
  opts: {
    companyId: string;
    extraMeta: JsonRecord;
    file: File;
    kind: "brand_asset" | "user_upload";
  },
): Promise<{ assetId: string; bytes: number; mime: string }> => {
  const { companyId, extraMeta, file, kind } = opts;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { assetId } = await storeAsset(env, db, {
    bytes,
    companyId,
    kind,
    metadata: { originalName: file.name || null, ...extraMeta },
    mime: file.type,
    visibility: "customer",
  });
  return { assetId, bytes: bytes.length, mime: file.type };
};

const readUploadedImage = (
  form: FormData,
): { error: string; status: 400 | 413 | 415 } | { file: File } => {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return { error: "Missing 'file' field", status: 400 };
  }
  if (!ALLOWED_UPLOAD_MIME.has(file.type)) {
    return { error: `Unsupported mime '${file.type}'`, status: 415 };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)`, status: 413 };
  }
  return { file };
};

const BRAND_CATEGORIES = new Set(["logo", "post", "reference", "other"]);
const brandAssetMetadataSchema = z.object({
  category: z.string().optional(),
  originalName: z.string().optional(),
});

meAssetsRoutes.post("/uploads", async (c) => {
  const { companyId } = c.get("session");

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid multipart body" }, 400);
  }

  const validated = readUploadedImage(form);
  if ("error" in validated) {
    return c.json({ error: validated.error }, validated.status);
  }

  const { assetId, bytes, mime } = await persistImageAsset(c.env, c.var.db, {
    companyId,
    extraMeta: {},
    file: validated.file,
    kind: "user_upload",
  });

  return c.json({ assetId, mime, size: bytes, url: assetReference(assetId) });
});

meAssetsRoutes.get("/brand-assets", async (c) => {
  const { companyId } = c.get("session");
  const results = await listAssets(c.var.db, companyId, { kind: "brand_asset", limit: 200 });

  const items = results.map((row) => {
    const metadata = brandAssetMetadataSchema.safeParse(row.metadata);
    return {
      category: metadata.success ? (metadata.data.category ?? "other") : "other",
      createdAt: new Date(row.createdAt).toISOString(),
      id: row.id,
      mimeType: row.mime,
      name: metadata.success ? (metadata.data.originalName ?? null) : null,
      size: row.bytes,
      url: assetReference(row.id),
    };
  });

  return c.json({ items });
});

meAssetsRoutes.post("/brand-assets", async (c) => {
  const session = c.get("session");

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Invalid multipart body" }, 400);
  }

  const validated = readUploadedImage(form);
  if ("error" in validated) {
    return c.json({ error: validated.error }, validated.status);
  }
  const rawCategory = form.get("category");
  const category =
    typeof rawCategory === "string" && BRAND_CATEGORIES.has(rawCategory) ? rawCategory : "other";

  const { assetId, bytes, mime } = await persistImageAsset(c.env, c.var.db, {
    companyId: session.companyId,
    extraMeta: { category },
    file: validated.file,
    kind: "brand_asset",
  });

  return c.json({ assetId, category, mime, size: bytes, url: assetReference(assetId) });
});

meAssetsRoutes.delete("/brand-assets/:id", async (c) => {
  const session = c.get("session");
  const id = c.req.param("id");
  const deleted = await deleteAssets(c.env, c.var.db, session.companyId, {
    ids: [id],
    kind: "brand_asset",
  });
  if (deleted === 0) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json({ ok: true });
});

const deleteAssetsInputSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

meAssetsRoutes.post("/assets/delete", async (c) => {
  const session = c.get("session");
  const parsed = deleteAssetsInputSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body" }, 400);
  }
  const { ids } = parsed.data;
  const deleted = await deleteAssets(c.env, c.var.db, session.companyId, {
    ids,
    visibility: "customer",
  });
  return c.json({ deleted });
});

export { meAssetsRoutes };
