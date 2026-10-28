import { dispatch } from "@flue/runtime";

import type { Verdict } from "#/action/approval";
import { CorrespondentV2 } from "#/agents/correspondent";
import type { JobContext } from "#/jobs/worker-job-steps";
import { withDb } from "#/lib/db";
import { loadTicket } from "#/ticket/ticket";

const CUSTOMER_UPDATES = {
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

const createNotifyCustomer =
  (send: typeof dispatch) =>
  async (job: JobContext, actionId: string, verdict: Verdict): Promise<void> => {
    const ticket = await withDb(job.env, (db) => loadTicket(db, job.ticketId));

    if (!ticket) {
      throw new Error(`ticket ${job.ticketId} not found`);
    }

    let body: string;
    let type: string;

    if (verdict === "execute") {
      const result = ticket.result?.summary;

      if (typeof result !== "string") {
        throw new TypeError(`ticket ${job.ticketId} has no executed result`);
      }

      type = "worker.deliverable_ready";
      body = `Um especialista do Time concluiu uma tarefa. Apresente este material ao cliente, em pt-BR, de forma calorosa e direta; mantenha as imagens em markdown e não altere o conteúdo:\n\n${result}`;
    } else {
      const update = CUSTOMER_UPDATES[verdict];
      type = update.type;
      body = `${update.instruction}\n\nPedido: ${ticket.brief}`;
    }

    await send(CorrespondentV2, {
      id: job.companyId,
      idempotencyKey: `${actionId}:${type}`,
      message: { body, kind: "signal", type },
    });
  };

const notifyCustomer = createNotifyCustomer(dispatch);

export { createNotifyCustomer, notifyCustomer };
