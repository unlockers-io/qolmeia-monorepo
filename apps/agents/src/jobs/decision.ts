import type { ActionStatus, DecisionOutcome } from "@repo/worker-api/contracts";

import { canRequestChanges } from "#/action/action";
import type { Db } from "#/lib/db";

type DecisionEvent = {
  decidedByUserId: string;
  decision: DecisionOutcome;
  feedback?: string;
};

type DecisionReceipt =
  | { ok: true }
  | { ok: false; reason: "no_workflow" | "not_found" | "revision_limit" }
  | { ok: false; reason: "not_pending"; status: ActionStatus };

const decisionEventType = (actionId: string): string => `decision-${actionId}`;

const submitDecision = async (
  env: Env,
  db: Db,
  actionId: string,
  event: DecisionEvent,
): Promise<DecisionReceipt> => {
  const action = await db.action.findUnique({
    select: { status: true, ticket: { select: { workflowId: true } }, ticketId: true },
    where: { id: actionId },
  });
  if (!action) {
    return { ok: false, reason: "not_found" };
  }
  if (action.status !== "pending") {
    return { ok: false, reason: "not_pending", status: action.status };
  }
  if (event.decision === "changes_requested" && !(await canRequestChanges(db, action.ticketId))) {
    return { ok: false, reason: "revision_limit" };
  }
  const { workflowId } = action.ticket;
  if (workflowId === null || workflowId === "") {
    return { ok: false, reason: "no_workflow" };
  }
  const instance = await env.WORKER_JOB.get(workflowId);
  await instance.sendEvent({ payload: event, type: decisionEventType(actionId) });
  return { ok: true };
};

export { decisionEventType, submitDecision };
export type { DecisionEvent };
