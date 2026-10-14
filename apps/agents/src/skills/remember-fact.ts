import { z } from "zod";

import { withDb } from "#/lib/db";
import { indexMemoryFacts, recordMemoryFacts } from "#/memory/facts";
import type { SkillContext, SkillInput, UnknownSkill } from "#/skills/registry";

const rememberFactInputSchema = z.object({
  content: z.string().min(1).describe("O fato a ser lembrado, em uma frase clara em pt-BR."),
  kind: z
    .string()
    .optional()
    .describe("Categoria do fato (ex: 'preference', 'decision', 'brand'). Default: 'fact'."),
});

const rememberFactSkill: UnknownSkill = {
  description:
    "Salva um fato importante que você deve lembrar em conversas futuras (preferências, decisões, fatos do negócio).",
  async execute(input: SkillInput, ctx: SkillContext): Promise<{ id: string; savedAt: number }> {
    const { content, kind } = rememberFactInputSchema.parse(input);
    const records = await withDb(ctx.env, (db) =>
      recordMemoryFacts(db, [
        {
          agentInstanceId: ctx.agentInstanceId,
          companyId: ctx.companyId,
          content,
          kind: kind ?? "fact",
        },
      ]),
    );
    await indexMemoryFacts(ctx.env, records);
    const [record] = records;
    if (record === undefined) {
      throw new Error("rememberFact: no fact recorded");
    }
    return { id: record.id, savedAt: record.createdAt };
  },
  id: "rememberFact",
  inputSchema: rememberFactInputSchema,
};

export { rememberFactSkill };
