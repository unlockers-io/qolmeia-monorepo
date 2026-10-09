import { z } from "zod";

import { defineSkill } from "#/skills/skill";

const PLATFORMS = ["instagram", "facebook", "linkedin", "twitter"] as const;

const draftSocialPostInputSchema = z.object({
  body: z
    .string()
    .min(1)
    .max(2200)
    .describe("Texto principal do post, em pt-BR. Já formatado para a plataforma escolhida."),
  callToAction: z
    .string()
    .min(1)
    .max(120)
    .describe("CTA final do post (ex: 'Visite-nos hoje', 'Compre agora')."),
  hashtags: z
    .array(z.string().min(1).max(60))
    .max(20)
    .optional()
    .describe("Lista de hashtags relevantes, sem o `#` (a renderização adiciona)."),
  platform: z.enum(PLATFORMS).describe("Plataforma alvo da publicação."),
  tone: z.string().min(1).max(60).describe("Tom da copy (ex: acolhedor, urgente, informativo)."),
});

type DraftSocialPostResult = {
  body: string;
  callToAction: string;
  hashtags: ReadonlyArray<string>;
  platform: (typeof PLATFORMS)[number];
  tone: string;
};

const draftSocialPostSkill = defineSkill({
  description:
    "Rascunha um post para redes sociais (Instagram, Facebook, LinkedIn, Twitter). Use quando o cliente pedir um post, conteúdo de feed/stories, ou copy de publicação.",
  displayName: "Rascunhar post social",
  execute: ({ body, callToAction, hashtags, platform, tone }): Promise<DraftSocialPostResult> =>
    Promise.resolve({
      body,
      callToAction,
      hashtags: hashtags ?? [],
      platform,
      tone,
    }),
  id: "draftSocialPost",
  inputSchema: draftSocialPostInputSchema,
});

export { draftSocialPostInputSchema, draftSocialPostSkill };
