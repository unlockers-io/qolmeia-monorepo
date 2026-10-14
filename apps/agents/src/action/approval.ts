import type { Prisma, TicketStatus } from "@repo/db/worker";
import type { DecisionOutcome } from "@repo/worker-api/contracts";

import { recordActivity, type ActivityRecord } from "#/activity/log";
import type { PrismaClient } from "#/lib/db";
import type { JsonRecord } from "#/lib/records";

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

const completeTicket = (
  db: PrismaClient,
  input: {
    companyId: string;
    policy: "auto_execute" | "notify_only";
    summary: string;
    ticketId: string;
  },
): Promise<void> =>
  db.$transaction(async (tx) => {
    await transitionTicket(tx, {
      activity: {
        companyId: input.companyId,
        refId: input.ticketId,
        refType: "ticket",
        summary:
          input.policy === "notify_only"
            ? "Ticket concluído (notify-only): disponível para conferência."
            : "Ticket concluído automaticamente (auto-execute).",
        type: "TICKET_DONE",
      },
      status: "done",
      summary: input.summary,
      ticketId: input.ticketId,
    });
    if (input.policy === "notify_only") {
      await recordActivity(tx, {
        companyId: input.companyId,
        payload: { summary: input.summary },
        refId: input.ticketId,
        refType: "ticket",
        summary: "Ação executada sem bloqueio, para conferência do operador.",
        type: "ACTION_NOTIFY",
      });
    }
  });

const proposeAction = (
  db: PrismaClient,
  input: {
    actionType: string;
    companyId: string;
    feedback: string | null;
    proposed: JsonRecord;
    round: number;
    summary: string;
    ticketId: string;
  },
): Promise<{ id: string }> =>
  db.$transaction(async (tx) => {
    const pending = await tx.action.findFirst({
      select: { id: true },
      where: { status: "pending", ticketId: input.ticketId },
    });
    if (pending) {
      return pending;
    }
    const action = await tx.action.create({
      data: {
        actionType: input.actionType,
        companyId: input.companyId,
        id: crypto.randomUUID(),
        policy: "require_approval",
        proposed: input.proposed,
        ticketId: input.ticketId,
      },
      select: { id: true },
    });
    await transitionTicket(tx, {
      activity:
        input.round > 0
          ? {
              companyId: input.companyId,
              payload: { feedback: input.feedback, revision: input.round },
              refId: action.id,
              refType: "action",
              summary: `Entrega revisada (revisão ${input.round}) aguardando decisão.`,
              type: "ACTION_REVISED",
            }
          : {
              companyId: input.companyId,
              payload: { actionId: action.id, summary: input.summary },
              refId: action.id,
              refType: "action",
              summary: "Ação proposta aguardando decisão.",
              type: "ACTION_PROPOSED",
            },
      status: "awaiting_approval",
      ticketId: input.ticketId,
    });
    return action;
  });

type DecisionInput = {
  actionId: string;
  companyId: string;
  decidedByUserId: string;
  decision: DecisionOutcome;
  feedback?: string;
  summary: string;
  ticketId: string;
};

const decisionTransition = (input: DecisionInput): TicketTransition => {
  const ref = {
    actorId: input.decidedByUserId,
    companyId: input.companyId,
    refId: input.actionId,
    refType: "action" as const,
  };
  const feedback = { feedback: input.feedback ?? null };
  if (input.decision === "approved") {
    return {
      activity: { ...ref, summary: "Ação aprovada e executada.", type: "ACTION_EXECUTED" },
      status: "done",
      summary: input.summary,
      ticketId: input.ticketId,
    };
  }
  if (input.decision === "rejected") {
    return {
      activity: { ...ref, payload: feedback, summary: "Ação rejeitada.", type: "ACTION_REJECTED" },
      status: "rejected",
      ticketId: input.ticketId,
    };
  }
  return {
    activity: {
      ...ref,
      payload: feedback,
      summary: "Ajustes pedidos.",
      type: "ACTION_CHANGES_REQUESTED",
    },
    status: "in_progress",
    ticketId: input.ticketId,
  };
};

const recordDecision = (db: PrismaClient, input: DecisionInput): Promise<void> =>
  db.$transaction(async (tx) => {
    const decided = await tx.action.updateMany({
      data: {
        decidedAt: new Date(),
        decidedByUserId: input.decidedByUserId,
        feedback: input.feedback ?? null,
        status: input.decision === "approved" ? "executed" : input.decision,
      },
      where: { id: input.actionId, status: "pending" },
    });
    if (decided.count === 0) {
      return;
    }
    await transitionTicket(tx, decisionTransition(input));
  });

export { completeTicket, proposeAction, recordDecision };
