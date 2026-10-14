import { z } from "zod";

import type { ExecutionContext, Generation } from "#/action/action-type";
import { withDb } from "#/lib/db";
import { promoteAssets } from "#/library/assets";

const deliverableAssetSchema = z.object({
  assetId: z.string(),
  deliverable: z.literal(true),
  url: z.string().optional(),
});

const deliverableSchema = z.object({
  assetIds: z.array(z.string()),
  summary: z.string(),
});

type Deliverable = z.infer<typeof deliverableSchema>;

const escapeRegExp = (value: string): string =>
  value.replaceAll(/[.*+?^$\{\}\(\)\|\[\]\\]/gv, String.raw`\$&`);

const embedImage = (summary: string, url: string): string => {
  const escaped = escapeRegExp(url);
  if (new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`, "v").test(summary)) {
    return summary;
  }
  const linkPattern = new RegExp(`\\[([^\\]]*)\\]\\(${escaped}\\)`, "v");
  if (linkPattern.test(summary)) {
    return summary.replace(linkPattern, (_match, label: string) => `![${label}](${url})`);
  }
  if (summary.includes(url)) {
    return summary.replace(url, `![](${url})`);
  }
  return `${summary}\n\n![](${url})`;
};

const readDeliverable = (generation: Generation): Deliverable => {
  const assets = generation.outputs.flatMap(({ json }) => {
    const parsed = deliverableAssetSchema.safeParse(JSON.parse(json));
    return parsed.success ? [parsed.data] : [];
  });
  return {
    assetIds: [...new Set(assets.map(({ assetId }) => assetId))],
    summary: assets.reduce(
      (summary, { url }) => (url === undefined || url === "" ? summary : embedImage(summary, url)),
      generation.summary,
    ),
  };
};

const releaseDeliverable = (
  ctx: ExecutionContext,
  assetIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<{ id: string; mime: string }>> =>
  withDb(ctx.env, (db) => promoteAssets(ctx.env, db, ctx.companyId, assetIds));

export { deliverableSchema, readDeliverable, releaseDeliverable };
