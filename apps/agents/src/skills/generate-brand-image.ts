import { z } from "zod";

import { withDb } from "#/lib/db";
import { generateImage, type ImagePromptPart } from "#/lib/models";
import { buildSignedAssetUrl, SIGNED_IMAGE_TTL_MS } from "#/lib/r2";
import { listBrandReferences, persistAsset } from "#/library/assets";
import { defineSkill, type SkillContext } from "#/skills/skill";

const generateBrandImageInputSchema = z.object({
  aspectRatio: z
    .enum(["1:1", "16:9", "4:3", "9:16"])
    .optional()
    .describe("Proporção: 1:1 (quadrado), 16:9 (horizontal), 9:16 (vertical), 4:3. Default: 1:1."),
  prompt: z
    .string()
    .min(1)
    .max(2000)
    .describe("Descrição vívida e específica do que deve aparecer na imagem, em pt-BR."),
});

const aspectHint = (aspect: string): string => {
  if (aspect === "16:9") {
    return " (proporção 16:9, formato horizontal)";
  }
  if (aspect === "9:16") {
    return " (proporção 9:16, formato vertical)";
  }
  if (aspect === "4:3") {
    return " (proporção 4:3)";
  }
  return " (proporção 1:1, quadrado)";
};

const decodeBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.codePointAt(i) ?? 0;
  }
  return out;
};

const encodeBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (const byte of bytes) {
    bin += String.fromCodePoint(byte);
  }
  return btoa(bin);
};

const MAX_BRAND_REFS = 3;

const loadBrandReferences = async (ctx: SkillContext): Promise<Array<string>> => {
  const results = await withDb(ctx.env, (db) =>
    listBrandReferences(db, ctx.companyId, MAX_BRAND_REFS),
  );

  const settled = await Promise.allSettled(
    results.map(async (row) => {
      const object = await ctx.env.ASSETS.get(row.r2Key);
      if (!object) {
        return null;
      }
      const bytes = new Uint8Array(await object.arrayBuffer());
      return `data:${row.mime};base64,${encodeBase64(bytes)}`;
    }),
  );
  return settled.flatMap((result) =>
    result.status === "fulfilled" && result.value !== null && result.value !== ""
      ? [result.value]
      : [],
  );
};

const parseDataUrl = (url: string): { bytes: Uint8Array; mime: string } | null => {
  const match = /^data:(?<mime>[^;]+);base64,(?<b64>.+)$/v.exec(url);
  if (!match) {
    return null;
  }
  const { b64, mime } = match.groups ?? {};
  if (mime === undefined || b64 === undefined) {
    return null;
  }
  return { bytes: decodeBase64(b64), mime };
};

type GenerateResult = { assetId: string; deliverable: true; url: string } | { error: string };

const generateBrandImageSkill = defineSkill({
  description:
    "Gera uma imagem alinhada à marca. Use quando o cliente pedir uma imagem, post visual, ou peça de design.",
  displayName: "Gerar imagem de marca",
  async execute({ aspectRatio = "1:1", prompt }, ctx): Promise<GenerateResult> {
    const fullPrompt = `${prompt}${aspectHint(aspectRatio)}`;

    const brandRefs = await loadBrandReferences(ctx);
    const userContent: string | Array<ImagePromptPart> =
      brandRefs.length > 0
        ? [
            {
              text: `${fullPrompt}\n\nUse as imagens de referência da marca anexadas para manter a identidade visual (cores, estilo, logotipo).`,
              type: "text",
            },
            ...brandRefs.map((url): ImagePromptPart => ({ image_url: { url }, type: "image_url" })),
          ]
        : fullPrompt;

    let imageUrl: string;
    try {
      imageUrl = await generateImage(ctx.env, userContent);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }

    const decoded = parseDataUrl(imageUrl);
    if (!decoded) {
      return { error: `Image gen returned non-data URL we can't ingest: ${imageUrl.slice(0, 60)}` };
    }
    const { bytes, mime } = decoded;
    const { assetId } = await withDb(ctx.env, (db) =>
      persistAsset(ctx.env, db, {
        bytes,
        companyId: ctx.companyId,
        fallbackExt: "png",
        kind: "generated_image",
        metadata: { aspectRatio, prompt },
        mime,
        uploadMetadata: { aspectRatio, prompt },
        visibility: ctx.deliverableFolder,
      }),
    );

    const url = await buildSignedAssetUrl(
      { ASSETS_SIGNING_KEY: ctx.env.ASSETS_SIGNING_KEY },
      ctx.env.WORKER_PUBLIC_URL,
      assetId,
      SIGNED_IMAGE_TTL_MS,
    );

    return { assetId, deliverable: true, url };
  },
  id: "generateBrandImage",
  inputSchema: generateBrandImageInputSchema,
});

export { generateBrandImageSkill };
