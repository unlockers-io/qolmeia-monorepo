import { dispatch } from "@flue/runtime";
import { log } from "@repo/observability";
import type { DecisionOutcome } from "@repo/worker-api/contracts";

import { completeTicket, proposeAction, recordDecision } from "#/action/approval";
import { resolvePolicy } from "#/action/policy";
import { CorrespondentV2 } from "#/agents/correspondent";
import { getCompany } from "#/company/company";
import { withDb } from "#/lib/db";
import { toRecord, type JsonValue } from "#/lib/records";
import { emitTeamEvent } from "#/team/events";
import { loadInstanceWithTemplate, loadTicket } from "#/ticket/ticket";

type JobContext = {
  agentInstanceId: string;
  companyId: string;
  env: Env;
  ticketId: string;
};

type GenerateResult = {
  skillResultsJson: string;
  summary: string;
};

type ProposeResult = { actionId: string | null; policy: string };

type ProposedPayload =
  | { draft: JsonValue; summary: string; ticketId: string }
  | { summary: string; ticketId: string };

type DecisionEvent = {
  decidedByUserId: string;
  decision: DecisionOutcome;
  feedback?: string;
};

const signalCorrespondent = async (ctx: JobContext, type: string, body: string): Promise<void> => {
  const { companyId, ticketId } = ctx;
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

const presentToCustomer = (ctx: JobContext, result: string): Promise<void> =>
  signalCorrespondent(
    ctx,
    "worker.deliverable_ready",
    `Um especialista do Time concluiu uma tarefa. Apresente este material ao cliente, em pt-BR, de forma calorosa e direta; mantenha as imagens em markdown e não altere o conteúdo:\n\n${result}`,
  );

const CUSTOMER_UPDATES = {
  changes_requested: {
    instruction:
      "O Time revisou o material do pedido abaixo e o especialista já está ajustando. Avise o cliente em uma frase curta, em pt-BR, que o ajuste está em andamento e que a nova versão aparece aqui no chat.",
    type: "worker.revising",
  },
  rejected: {
    instruction:
      "O material do pedido abaixo foi revisado pelo Time e não será entregue. Avise o cliente em pt-BR, de forma breve e cordial, e pergunte se ele quer ajustar o pedido para o Time tentar de novo.",
    type: "worker.deliverable_rejected",
  },
} satisfies Record<Exclude<DecisionOutcome, "approved">, { instruction: string; type: string }>;

const reportDecision = async (
  ctx: JobContext,
  decision: Exclude<DecisionOutcome, "approved">,
): Promise<void> => {
  const ticket = await withDb(ctx.env, (db) => loadTicket(db, ctx.ticketId));
  const update = CUSTOMER_UPDATES[decision];
  await signalCorrespondent(
    ctx,
    update.type,
    `${update.instruction}\n\nPedido: ${ticket?.brief ?? ""}`,
  );
};

const proposeDeliverable = async (
  ctx: JobContext,
  round: number,
  feedback: string | null,
  current: GenerateResult,
): Promise<ProposeResult> => {
  const { agentInstanceId, companyId, env, ticketId } = ctx;
  const [{ template }, company] = await withDb(env, (db) =>
    Promise.all([loadInstanceWithTemplate(db, agentInstanceId), getCompany(db, companyId)]),
  );
  if (!company) {
    throw new Error("company vanished mid-workflow");
  }
  const actionType = template.defaultActionType;
  const policy = resolvePolicy(actionType, template);

  if (policy === "auto_execute" || policy === "notify_only") {
    await withDb(env, (db) =>
      completeTicket(db, { companyId, policy, summary: current.summary, ticketId }),
    );
    await emitTeamEvent(env, { companyId, reason: "ticket_changed", type: "team:status" });
    await presentToCustomer(ctx, current.summary);
    return { actionId: null, policy };
  }

  const skillResults: Partial<Record<string, JsonValue>> = toRecord(
    JSON.parse(current.skillResultsJson),
  );
  const draft = skillResults.draftSocialPost;
  const proposedPayload: ProposedPayload =
    actionType === "publish_post" && draft !== undefined
      ? { draft, summary: current.summary, ticketId }
      : { summary: current.summary, ticketId };
  const { id: actionId } = await withDb(env, (db) =>
    proposeAction(db, {
      actionType,
      companyId,
      feedback,
      proposed: proposedPayload,
      round,
      summary: current.summary,
      ticketId,
    }),
  );
  await emitTeamEvent(env, { companyId, reason: "ticket_changed", type: "team:status" });

  log.info({
    actionId,
    agentInstanceId,
    companyId,
    message: "workflow.propose.ok",
    policy,
    ticketId,
  });
  return { actionId, policy };
};

const applyDecision = async (
  ctx: JobContext,
  actionId: string,
  current: GenerateResult,
  event: DecisionEvent,
): Promise<DecisionOutcome> => {
  const { agentInstanceId, companyId, env, ticketId } = ctx;
  const { decidedByUserId, decision, feedback } = event;
  log.info({
    actionId,
    agentInstanceId,
    companyId,
    decidedByUserId,
    decision,
    feedback: feedback ?? null,
    message: "workflow.decision.received",
    ticketId,
  });
  await withDb(env, (db) =>
    recordDecision(db, {
      actionId,
      companyId,
      decidedByUserId,
      decision,
      feedback,
      summary: current.summary,
      ticketId,
    }),
  );
  await emitTeamEvent(env, { companyId, reason: "ticket_changed", type: "team:status" });
  await (decision === "approved"
    ? presentToCustomer(ctx, current.summary)
    : reportDecision(ctx, decision));
  return decision;
};

export { applyDecision, proposeDeliverable };
export type { DecisionEvent, GenerateResult, JobContext, ProposeResult };
