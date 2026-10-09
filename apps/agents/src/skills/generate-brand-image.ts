import { z } from "zod";

import { withDb } from "#/lib/db";
import { generateImage, type ImagePromptPart } from "#/lib/models";
import { assetReference, readBrandReferences, storeAsset } from "#/library/assets";
import { defineSkill } from "#/skills/skill";

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

const MAX_BRAND_REFS = 3;

const parseDataUrl = (url: string): { bytes: Uint8Array; mime: string } | null => {
  const match = /^data:(?<mime>[^;]+);base64,(?<b64>.+)$/v.exec(url);
  if (!match) {
    return null;
  }
  const { b64, mime } = match.groups ?? {};
  if (mime === undefined || b64 === undefined) {
    return null;
  }
  return { bytes: Uint8Array.fromBase64(b64), mime };
};

type GenerateResult = { assetId: string; deliverable: true; url: string } | { error: string };

const generateBrandImageSkill = defineSkill({
  description:
    "Gera uma imagem alinhada à marca. Use quando o cliente pedir uma imagem, post visual, ou peça de design.",
  displayName: "Gerar imagem de marca",
  async execute({ aspectRatio = "1:1", prompt }, ctx): Promise<GenerateResult> {
    const fullPrompt = `${prompt}${aspectHint(aspectRatio)}`;

    const brandRefs = await withDb(ctx.env, (db) =>
      readBrandReferences(ctx.env, db, ctx.companyId, MAX_BRAND_REFS),
    );
    const userContent: string | Array<ImagePromptPart> =
      brandRefs.length > 0
        ? [
            {
              text: `${fullPrompt}\n\nUse as imagens de referência da marca anexadas para manter a identidade visual (cores, estilo, logotipo).`,
              type: "text",
            },
            ...brandRefs.map(({ bytes, mime }): ImagePromptPart => ({
              image_url: { url: `data:${mime};base64,${bytes.toBase64()}` },
              type: "image_url",
            })),
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
      storeAsset(ctx.env, db, {
        bytes,
        companyId: ctx.companyId,
        kind: "generated_image",
        metadata: { aspectRatio, prompt },
        mime,
        visibility: ctx.deliverableFolder,
      }),
    );

    return { assetId, deliverable: true, url: assetReference(assetId) };
  },
  id: "generateBrandImage",
  inputSchema: generateBrandImageInputSchema,
});

export { generateBrandImageSkill };
