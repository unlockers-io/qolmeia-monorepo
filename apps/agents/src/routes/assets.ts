import { Hono } from "hono";

import { requireMember, type IdentityEnv } from "#/identity/gates";
import { dbPerRequest } from "#/lib/db";
import { openAsset } from "#/library/assets";

const assetsRoutes = new Hono<IdentityEnv>();

const buildAssetHeaders = (mime: string) => {
  const headers = new Headers({
    "Cache-Control": "private, max-age=3600",
    "Content-Type": mime,
    "X-Content-Type-Options": "nosniff",
  });
  if (mime === "image/svg+xml") {
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
  }
  return headers;
};

assetsRoutes.get("/:id", dbPerRequest, requireMember, async (c) => {
  const asset = await openAsset(c.env, c.var.db, c.req.param("id"), c.get("session"));
  if (!asset) {
    return c.text("Not found", 404);
  }
  return new Response(asset.body, { headers: buildAssetHeaders(asset.mime) });
});

export { assetsRoutes };
