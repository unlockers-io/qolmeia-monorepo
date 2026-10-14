import { z } from "zod";

import { withDb } from "#/lib/db";
import { remember } from "#/memory/memory";
import { defineSkill } from "#/skills/skill";

const rememberFactInputSchema = z.object({
  content: z.string().min(1).describe("O fato a ser lembrado, em uma frase clara em pt-BR."),
  kind: z
    .string()
    .optional()
    .describe("Categoria do fato (ex: 'preference', 'decision', 'brand'). Default: 'fact'."),
});

const rememberFactSkill = defineSkill({
  description:
    "Salva um fato importante que você deve lembrar em conversas futuras (preferências, decisões, fatos do negócio).",
  displayName: "Lembrar fato",
  async execute({ content, kind }, ctx): Promise<{ id: string; savedAt: number }> {
    const [fact] = await withDb(ctx.env, (db) =>
      remember(ctx.env, db, ctx.companyId, [
        { agentInstanceId: ctx.agentInstanceId, content, kind: kind ?? "fact" },
      ]),
    );
    if (fact === undefined) {
      throw new Error("rememberFact: no fact recorded");
    }
    return { id: fact.id, savedAt: fact.createdAt.getTime() };
  },
  id: "rememberFact",
  inputSchema: rememberFactInputSchema,
});

export { rememberFactSkill };
