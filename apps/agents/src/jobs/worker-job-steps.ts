import { dispatch } from "@flue/runtime";
import { log } from "@repo/observability";
import type { ActionPolicy, ActionType } from "@repo/worker-api/contracts";

import { getProposedPayload } from "#/action/action";
import type { Generation } from "#/action/action-type";
import { ACTION_TYPE_MODULES, resolvePolicy } from "#/action/action-types";
import { markExecuted, proposeAction, recordDecision, type Verdict } from "#/action/approval";
import { CorrespondentV2 } from "#/agents/correspondent";
import type { DecisionEvent } from "#/jobs/decision";
import { withDb } from "#/lib/db";
import { emitTeamEvent } from "#/team/events";
import { loadInstanceWithTemplate, loadTicket } from "#/ticket/ticket";

type JobContext = {
  agentInstanceId: string;
  companyId: string;
  env: Env;
  ticketId: string;
};

type Proposal = {
  actionId: string;
  actionType: ActionType;
  policy: ActionPolicy;
};

const signalCorrespondent = async (job: JobContext, type: string, body: string): Promise<void> => {
  const { companyId, ticketId } = job;
  try {
    await dispatch(CorrespondentV2, { id: companyId, message: { body, kind: "signal", type } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({
      companyId,
      error: message,
      message: "workflow.signal.err",
      signal: type,
      ticketId,
    });
  }
};

const presentToCustomer = (job: JobContext, result: string): Promise<void> =>
  signalCorrespondent(
    job,
    "worker.deliverable_ready",
    `Um especialista do Time concluiu uma tarefa. Apresente este material ao cliente, em pt-BR, de forma calorosa e direta; mantenha as imagens em markdown e não altere o conteúdo:\n\n${result}`,
  );

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

const reportVerdict = async (
  job: JobContext,
  verdict: Exclude<Verdict, "execute">,
): Promise<void> => {
  const ticket = await withDb(job.env, (db) => loadTicket(db, job.ticketId));
  const update = CUSTOMER_UPDATES[verdict];
  await signalCorrespondent(
    job,
    update.type,
    `${update.instruction}\n\nPedido: ${ticket?.brief ?? ""}`,
  );
};

const announceTicketChange = (job: JobContext): Promise<void> =>
  emitTeamEvent(job.env, {
    companyId: job.companyId,
    reason: "ticket_changed",
    type: "team:status",
  });

const proposeDeliverable = async (
  job: JobContext,
  round: number,
  feedback: string | null,
  generation: Generation,
): Promise<Proposal> => {
  const { agentInstanceId, companyId, env, ticketId } = job;
  const { template } = await withDb(env, (db) => loadInstanceWithTemplate(db, agentInstanceId));
  const actionType = template.defaultActionType;
  const policy = resolvePolicy(actionType, template);
  const proposed = ACTION_TYPE_MODULES[actionType].propose(generation);
  const { id: actionId } = await withDb(env, (db) =>
    proposeAction(db, {
      actionType,
      companyId,
      feedback,
      policy,
      proposed,
      round,
      summary: generation.summary,
      ticketId,
    }),
  );
  if (policy === "require_approval") {
    await announceTicketChange(job);
  }
  log.info({
    actionId,
    actionType,
    agentInstanceId,
    companyId,
    message: "workflow.propose.ok",
    policy,
    ticketId,
  });
  return { actionId, actionType, policy };
};

const applyDecision = async (
  job: JobContext,
  proposal: Proposal,
  round: number,
  event: DecisionEvent,
): Promise<Verdict> => {
  const { agentInstanceId, companyId, env, ticketId } = job;
  const { decidedByUserId, decision, feedback } = event;
  log.info({
    actionId: proposal.actionId,
    agentInstanceId,
    companyId,
    decidedByUserId,
    decision,
    feedback: feedback ?? null,
    message: "workflow.decision.received",
    ticketId,
  });
  const verdict = await withDb(env, (db) =>
    recordDecision(db, {
      actionId: proposal.actionId,
      companyId,
      decidedByUserId,
      decision,
      feedback,
      round,
      ticketId,
    }),
  );
  await announceTicketChange(job);
  if (verdict !== "execute") {
    await reportVerdict(job, verdict);
  }
  return verdict;
};

const executeAction = async (job: JobContext, proposal: Proposal): Promise<void> => {
  const { companyId, env, ticketId } = job;
  const proposed = await withDb(env, (db) => getProposedPayload(db, proposal.actionId));
  const result = await ACTION_TYPE_MODULES[proposal.actionType].execute(
    { companyId, env },
    proposed,
  );
  await withDb(env, (db) =>
    markExecuted(db, {
      actionId: proposal.actionId,
      companyId,
      policy: proposal.policy,
      result,
      ticketId,
    }),
  );
  await announceTicketChange(job);
  await presentToCustomer(job, result);
};

export { applyDecision, executeAction, proposeDeliverable };
export type { JobContext, Proposal };
