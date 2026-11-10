import type { Prisma, TicketStatus } from "@repo/db/worker";
import type {
  ActionPolicy,
  ActionType,
  DecisionOutcome,
  ProposedOf,
} from "@repo/worker-api/contracts";

import { actionIdFor, canRevise, MAX_REVISIONS } from "#/action/action";
import { recordActivity, type ActivityRecord } from "#/activity/log";
import type { PrismaClient } from "#/lib/db";
import { emitTeamEvent, type TeamEventsEnv } from "#/team/events";

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

type ProposalInput = {
  actionType: ActionType;
  companyId: string;
  feedback: string | null;
  policy: ActionPolicy;
  proposed: ProposedOf<ActionType>;
  round: number;
  summary: string;
  ticketId: string;
};

const proposalActivity = (input: ProposalInput, id: string): ActivityRecord =>
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
      };

/** A gated Action waits for a Decision; any other clears to execute at once. */
const proposeAction = async (
  env: TeamEventsEnv,
  db: PrismaClient,
  input: ProposalInput,
): Promise<{ id: string }> => {
  const id = actionIdFor(input.ticketId, input.round);
  const gated = input.policy === "require_approval";

  const created = await db.$transaction(async (tx) => {
    const existing = await tx.action.findUnique({ select: { id: true }, where: { id } });

    if (existing) {
      return false;
    }

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
        activity: proposalActivity(input, id),
        status: "awaiting_approval",
        ticketId: input.ticketId,
      });
    }

    return true;
  });

  if (created && gated) {
    await emitTeamEvent(env, { companyId: input.companyId, type: "team:status" });
  }

  return { id };
};

type DecisionRecord = {
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

const decisionActivity = (input: DecisionRecord, verdict: Verdict): ActivityRecord => {
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

const recordDecision = async (
  env: TeamEventsEnv,
  db: PrismaClient,
  input: DecisionRecord,
): Promise<Verdict> => {
  const verdict = verdictOf(input.decision, input.round);

  const decided = await db.$transaction(async (tx) => {
    const { count } = await tx.action.updateMany({
      data: {
        decidedAt: new Date(),
        decidedByUserId: input.decidedByUserId,
        feedback: input.feedback ?? null,
        status: input.decision,
      },
      where: { id: input.actionId, status: "pending" },
    });

    if (count > 0) {
      await transitionTicket(tx, {
        activity: decisionActivity(input, verdict),
        status: TICKET_STATUS_BY_VERDICT[verdict],
        ticketId: input.ticketId,
      });
    }

    return count > 0;
  });

  if (decided) {
    await emitTeamEvent(env, { companyId: input.companyId, type: "team:status" });
  }

  return verdict;
};

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

const markExecuted = async (
  env: TeamEventsEnv,
  db: PrismaClient,
  input: ExecutionInput,
): Promise<void> => {
  const executed = await db.$transaction(async (tx) => {
    const { count } = await tx.action.updateMany({
      data: { status: "executed" },
      where: { id: input.actionId, status: "approved" },
    });

    if (count > 0) {
      await transitionTicket(tx, {
        activity: executionActivity(input),
        status: "done",
        summary: input.result,
        ticketId: input.ticketId,
      });
    }

    return count > 0;
  });

  if (executed) {
    await emitTeamEvent(env, { companyId: input.companyId, type: "team:status" });
  }
};

export { markExecuted, proposeAction, recordDecision };

export type { Verdict };
