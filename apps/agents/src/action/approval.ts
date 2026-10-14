import type { Prisma, TicketStatus } from "@repo/db/worker";
import type { ActionPolicy, ActionType, DecisionOutcome } from "@repo/worker-api/contracts";

import { actionIdFor, canRevise, MAX_REVISIONS } from "#/action/action";
import { recordActivity, type ActivityRecord } from "#/activity/log";
import type { PrismaClient } from "#/lib/db";
import type { JsonRecord } from "#/lib/records";

type Verdict = "end" | "execute" | "revise";

type TicketTransition = {
  activity: ActivityRecord;
  status: TicketStatus;
  summary?: string;
  ticketId: string;
};

const transitionTicket = async (
  tx: Prisma.TransactionClient,
  transition: TicketTransition,
): Promise<void> => {
  await tx.ticket.update({
    data:
      transition.summary === undefined
        ? { status: transition.status }
        : { result: { summary: transition.summary }, status: transition.status },
    where: { id: transition.ticketId },
  });
  await recordActivity(tx, transition.activity);
};

const proposeAction = (
  db: PrismaClient,
  input: {
    actionType: ActionType;
    companyId: string;
    feedback: string | null;
    policy: ActionPolicy;
    proposed: JsonRecord;
    round: number;
    summary: string;
    ticketId: string;
  },
): Promise<{ id: string }> =>
  db.$transaction(async (tx) => {
    const id = actionIdFor(input.ticketId, input.round);
    const existing = await tx.action.findUnique({ select: { id: true }, where: { id } });
    if (existing) {
      return existing;
    }
    const gated = input.policy === "require_approval";
    await tx.action.create({
      data: {
        actionType: input.actionType,
        companyId: input.companyId,
        id,
        policy: input.policy,
        proposed: input.proposed,
        status: gated ? "pending" : "approved",
        ticketId: input.ticketId,
      },
    });
    if (gated) {
      await transitionTicket(tx, {
        activity:
          input.round > 0
            ? {
                companyId: input.companyId,
                payload: { feedback: input.feedback, revision: input.round },
                refId: id,
                refType: "action",
                summary: `Entrega revisada (revisão ${input.round}) aguardando decisão.`,
                type: "ACTION_REVISED",
              }
            : {
                companyId: input.companyId,
                payload: { actionId: id, summary: input.summary },
                refId: id,
                refType: "action",
                summary: "Ação proposta aguardando decisão.",
                type: "ACTION_PROPOSED",
              },
        status: "awaiting_approval",
        ticketId: input.ticketId,
      });
    }
    return { id };
  });

type DecisionInput = {
  actionId: string;
  companyId: string;
  decidedByUserId: string;
  decision: DecisionOutcome;
  feedback?: string;
  round: number;
  ticketId: string;
};

const TICKET_STATUS_BY_VERDICT = {
  end: "rejected",
  execute: "in_progress",
  revise: "in_progress",
} satisfies Record<Verdict, TicketStatus>;

const verdictOf = (decision: DecisionOutcome, round: number): Verdict => {
  if (decision === "approved") {
    return "execute";
  }
  return decision === "changes_requested" && canRevise(round) ? "revise" : "end";
};

const decisionActivity = (input: DecisionInput, verdict: Verdict): ActivityRecord => {
  const ref = {
    actorId: input.decidedByUserId,
    companyId: input.companyId,
    payload: { feedback: input.feedback ?? null },
    refId: input.actionId,
    refType: "action" as const,
  };
  if (input.decision === "approved") {
    return { ...ref, summary: "Ação aprovada.", type: "ACTION_APPROVED" };
  }
  if (input.decision === "rejected") {
    return { ...ref, summary: "Ação rejeitada.", type: "ACTION_REJECTED" };
  }
  return {
    ...ref,
    summary:
      verdict === "revise"
        ? "Ajustes pedidos."
        : `Ajustes pedidos além do limite de ${MAX_REVISIONS} revisões: ticket encerrado.`,
    type: "ACTION_CHANGES_REQUESTED",
  };
};

const recordDecision = (db: PrismaClient, input: DecisionInput): Promise<Verdict> =>
  db.$transaction(async (tx) => {
    const verdict = verdictOf(input.decision, input.round);
    const decided = await tx.action.updateMany({
      data: {
        decidedAt: new Date(),
        decidedByUserId: input.decidedByUserId,
        feedback: input.feedback ?? null,
        status: input.decision,
      },
      where: { id: input.actionId, status: "pending" },
    });
    if (decided.count > 0) {
      await transitionTicket(tx, {
        activity: decisionActivity(input, verdict),
        status: TICKET_STATUS_BY_VERDICT[verdict],
        ticketId: input.ticketId,
      });
    }
    return verdict;
  });

type ExecutionInput = {
  actionId: string;
  companyId: string;
  policy: ActionPolicy;
  result: string;
  ticketId: string;
};

const executionActivity = (input: ExecutionInput): ActivityRecord => {
  const ref = { companyId: input.companyId, refId: input.actionId, refType: "action" as const };
  if (input.policy === "notify_only") {
    return {
      ...ref,
      payload: { summary: input.result },
      summary: "Ação executada sem bloqueio, para conferência do operador.",
      type: "ACTION_NOTIFY",
    };
  }
  return {
    ...ref,
    summary:
      input.policy === "auto_execute"
        ? "Ação executada automaticamente."
        : "Ação executada após aprovação.",
    type: "ACTION_EXECUTED",
  };
};

const markExecuted = (db: PrismaClient, input: ExecutionInput): Promise<void> =>
  db.$transaction(async (tx) => {
    const executed = await tx.action.updateMany({
      data: { status: "executed" },
      where: { id: input.actionId, status: "approved" },
    });
    if (executed.count > 0) {
      await transitionTicket(tx, {
        activity: executionActivity(input),
        status: "done",
        summary: input.result,
        ticketId: input.ticketId,
      });
    }
  });

export { markExecuted, proposeAction, recordDecision };
export type { Verdict };
