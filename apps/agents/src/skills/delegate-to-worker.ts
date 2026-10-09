import { z } from "zod";

import { withDb } from "#/lib/db";
import { defineSkill } from "#/skills/skill";
import { delegateTicket } from "#/ticket/delegation";

const delegateInputSchema = z.object({
  brief: z
    .string()
    .min(1)
    .max(2000)
    .describe("Resumo claro da tarefa em pt-BR: o que o especialista precisa fazer."),
  workerKind: z
    .string()
    .min(1)
    .describe("Tipo do especialista (ex: 'designer', 'marketing-strategist')."),
});

const delegateToWorkerSkill = defineSkill({
  description:
    "Delega uma tarefa a um especialista do Time. Use quando o pedido exige uma especialidade que você não executa diretamente (ex: criar imagem → designer).",
  displayName: "Delegar para especialista",
  async execute({ brief, workerKind }, ctx) {
    return withDb(ctx.env, (db) =>
      delegateTicket(ctx.env, db, {
        brief,
        companyId: ctx.companyId,
        delegatorId: ctx.agentInstanceId,
        workerKind,
      }),
    );
  },
  id: "delegateToWorker",
  inputSchema: delegateInputSchema,
});

export { delegateToWorkerSkill };
