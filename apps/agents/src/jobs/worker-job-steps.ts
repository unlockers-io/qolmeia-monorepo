import { log } from "@repo/observability";
import type { ActionPolicy, ActionType } from "@repo/worker-api/contracts";

import { getProposedPayload } from "#/action/action";
import type { Generation } from "#/action/action-type";
import { ACTION_TYPE_MODULES, resolvePolicy } from "#/action/action-types";
import { markExecuted, proposeAction, recordDecision, type Verdict } from "#/action/approval";
import type { DecisionEvent } from "#/jobs/decision";
import { withDb } from "#/lib/db";
import { emitTeamEvent } from "#/team/events";
import { loadInstanceWithTemplate } from "#/ticket/ticket";

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
  return verdict;
};

const executeAction = async (job: JobContext, proposal: Proposal): Promise<void> => {
  const { companyId, env, ticketId } = job;
  const action = await withDb(env, (db) =>
    db.action.findUniqueOrThrow({
      select: { status: true },
      where: { id: proposal.actionId },
    }),
  );
  if (action.status === "executed") {
    return;
  }
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
};

export { applyDecision, executeAction, proposeDeliverable };
export type { JobContext, Proposal };
