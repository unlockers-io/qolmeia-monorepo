import { z } from "zod";

import { withDb } from "#/lib/db";
import { recall } from "#/memory/memory";
import { defineSkill } from "#/skills/skill";

const recallMemoryInputSchema = z.object({
  query: z.string().min(1).describe("O que você está procurando, em uma frase clara em pt-BR."),
  topK: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Quantos resultados retornar. Default: 4."),
});

type RecallResult = {
  matches: ReadonlyArray<{ content: string; createdAt: number; kind: string; score: number }>;
};

const recallMemorySkill = defineSkill({
  description:
    "Busca na memória deste agente fatos relevantes para uma consulta. Use quando precisar de algo específico que pode estar fora do contexto atual.",
  displayName: "Recordar memória",
  async execute({ query, topK }, ctx): Promise<RecallResult> {
    const facts = await withDb(ctx.env, (db) =>
      recall(ctx.env, db, ctx.companyId, {
        agentInstanceId: ctx.agentInstanceId,
        text: query,
        topK: topK ?? 4,
      }),
    );
    return {
      matches: facts.map((fact) => ({
        content: fact.content,
        createdAt: fact.createdAt.getTime(),
        kind: fact.kind,
        score: fact.score,
      })),
    };
  },
  id: "recallMemory",
  inputSchema: recallMemoryInputSchema,
});

export { recallMemorySkill };
