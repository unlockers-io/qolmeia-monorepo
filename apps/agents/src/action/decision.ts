import type { DecisionInput } from "@repo/worker-api/contracts";

import { canRequestChanges } from "#/action/action";
import type { Db } from "#/lib/db";
import { DomainError } from "#/lib/errors";

type DecisionEvent = DecisionInput & { decidedByUserId: string };

const decisionEventType = (actionId: string): string => `decision-${actionId}`;

/** Hands an Operator's Decision to the Ticket's Workflow, whose instance id is the Ticket id. */
const submitDecision = async (
  env: Pick<Env, "WORKER_JOB">,
  db: Db,
  actionId: string,
  event: DecisionEvent,
): Promise<void> => {
  const action = await db.action.findUnique({
    select: { status: true, ticketId: true },
    where: { id: actionId },
  });

  if (!action) {
    throw new DomainError(404, "not found");
  }

  if (action.status !== "pending") {
    throw new DomainError(409, `action already ${action.status}`);
  }

  if (event.decision === "changes_requested" && !(await canRequestChanges(db, action.ticketId))) {
    throw new DomainError(409, "revision limit reached");
  }

  const instance = await env.WORKER_JOB.get(action.ticketId);
  await instance.sendEvent({ payload: event, type: decisionEventType(actionId) });
};

export { decisionEventType, submitDecision };

export type { DecisionEvent };
