import { log } from "@repo/observability";
import { ticketResultSchema, type ActionPolicy, type ActionType } from "@repo/worker-api/contracts";

import type { Generation } from "#/action/action-type";
import { ACTION_TYPE_MODULES, resolvePolicy } from "#/action/action-types";
import { markExecuted, proposeAction, recordDecision, type Verdict } from "#/action/approval";
import type { DecisionEvent } from "#/action/decision";
import { withDb } from "#/lib/db";
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

const proposeDeliverable = (
  job: JobContext,
  round: number,
  feedback: string | null,
  generation: Generation,
): Promise<Proposal> =>
  withDb(job.env, async (db) => {
    const { agentInstanceId, companyId, env, ticketId } = job;
    const { template } = await loadInstanceWithTemplate(db, agentInstanceId);
    const actionType = template.defaultActionType;
    const policy = resolvePolicy(actionType, template);

    const { id: actionId } = await proposeAction(env, db, {
      actionType,
      companyId,
      feedback,
      policy,
      proposed: ACTION_TYPE_MODULES[actionType].propose(generation),
      round,
      summary: generation.summary,
      ticketId,
    });

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
  });

const applyDecision = (
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

  return withDb(env, (db) =>
    recordDecision(env, db, {
      actionId: proposal.actionId,
      companyId,
      decidedByUserId,
      decision,
      feedback,
      round,
      ticketId,
    }),
  );
};

/** Runs the Action type's effect once and returns what reaches the customer. */
const executeAction = (job: JobContext, proposal: Proposal): Promise<string> =>
  withDb(job.env, async (db) => {
    const { companyId, env, ticketId } = job;

    const action = await db.action.findUniqueOrThrow({
      select: { proposed: true, status: true },
      where: { id: proposal.actionId },
    });

    if (action.status === "executed") {
      const ticket = await db.ticket.findUniqueOrThrow({
        select: { result: true },
        where: { id: ticketId },
      });

      return ticketResultSchema.parse(ticket.result).summary;
    }

    const result = await ACTION_TYPE_MODULES[proposal.actionType].execute(
      { companyId, db },
      action.proposed,
    );

    await markExecuted(env, db, {
      actionId: proposal.actionId,
      companyId,
      policy: proposal.policy,
      result,
      ticketId,
    });

    return result;
  });

export { applyDecision, executeAction, proposeDeliverable };

export type { JobContext, Proposal };
