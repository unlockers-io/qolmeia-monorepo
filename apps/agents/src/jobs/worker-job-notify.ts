import { dispatch } from "@flue/runtime";

import type { Verdict } from "#/action/approval";
import { signalCorrespondent } from "#/conversation/signal";
import type { JobContext } from "#/jobs/worker-job-steps";
import { withDb } from "#/lib/db";

type CustomerUpdate =
  | { result: string; verdict: "execute" }
  | { verdict: Exclude<Verdict, "execute"> };

const DECISION_UPDATES = {
  end: {
    instruction:
      "O material do pedido abaixo foi revisado pelo Time e não será entregue. Avise o cliente em pt-BR, de forma breve e cordial, e pergunte se ele quer ajustar o pedido para o Time tentar de novo.",
    type: "worker.deliverable_rejected",
  },
  revise: {
    instruction:
      "O Time revisou o material do pedido abaixo e o especialista já está ajustando. Avise o cliente em uma frase curta, em pt-BR, que o ajuste está em andamento e que a nova versão aparece aqui no chat.",
    type: "worker.revising",
  },
} satisfies Record<Exclude<Verdict, "execute">, { instruction: string; type: string }>;

const signalFor = async (
  job: JobContext,
  update: CustomerUpdate,
): Promise<{ body: string; type: string }> => {
  if (update.verdict === "execute") {
    return {
      body: `Um especialista do Time concluiu uma tarefa. Apresente este material ao cliente, em pt-BR, de forma calorosa e direta; mantenha as imagens em markdown e não altere o conteúdo:\n\n${update.result}`,
      type: "worker.deliverable_ready",
    };
  }

  const { brief } = await withDb(job.env, (db) =>
    db.ticket.findUniqueOrThrow({ select: { brief: true }, where: { id: job.ticketId } }),
  );

  const { instruction, type } = DECISION_UPDATES[update.verdict];

  return { body: `${instruction}\n\nPedido: ${brief}`, type };
};

const createNotifyCustomer =
  (send: typeof dispatch) =>
  async (job: JobContext, actionId: string, update: CustomerUpdate): Promise<void> => {
    const { body, type } = await signalFor(job, update);

    await signalCorrespondent(
      job.companyId,
      { body, idempotencyKey: `${actionId}:${type}`, type },
      send,
    );
  };

const notifyCustomer = createNotifyCustomer(dispatch);

export { createNotifyCustomer, notifyCustomer };
