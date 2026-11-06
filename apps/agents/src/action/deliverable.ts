import type { Deliverable } from "@repo/worker-api/contracts";

import type { Generation } from "#/action/action-type";
import { assetOutputSchema } from "#/action/action-type";

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
    const parsed = assetOutputSchema.safeParse(JSON.parse(json));

    return parsed.success && parsed.data.deliverable ? [parsed.data] : [];
  });

  return {
    assetIds: [...new Set(assets.map(({ assetId }) => assetId))],
    summary: assets.reduce(
      (summary, { url }) => (url === undefined || url === "" ? summary : embedImage(summary, url)),
      generation.summary,
    ),
  };
};

export { readDeliverable };
