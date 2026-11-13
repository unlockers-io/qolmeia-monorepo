import type { Prisma } from "@repo/db/worker";
import {
  actionTypeSchema,
  type Action,
  type ActionDetailResponse,
  type ActionOf,
  type ActionType,
  type OperatorCoverage,
  type PendingAction,
} from "@repo/worker-api/contracts";

import { ACTION_TYPE_MODULES } from "#/action/action-types";
import type { Db } from "#/lib/db";
import { notFound } from "#/lib/errors";
import { agentSummarySelect, ticketInclude, toAgentSummary, toTicket } from "#/ticket/ticket";

const MAX_REVISIONS = 3;

const canRevise = (round: number): boolean => round < MAX_REVISIONS;

const canReviseAfter = (roundCount: number): boolean => canRevise(roundCount - 1);

const actionIdFor = (ticketId: string, round: number): string => `${ticketId}-r${round}`;

const actionInclude = {
  company: { select: { name: true } },
  ticket: { select: { agentInstance: { select: agentSummarySelect } } },
} as const satisfies Prisma.ActionInclude;

type ActionRow = Prisma.ActionGetPayload<{ include: typeof actionInclude }>;

type Proposal<Type extends ActionType> = {
  [T in Type]: Pick<ActionOf<T>, "actionType" | "proposed">;
}[Type];

const proposalOf = <Type extends ActionType>(
  actionType: Type,
  proposed: Prisma.JsonValue,
): Proposal<Type> => ({ actionType, proposed: ACTION_TYPE_MODULES[actionType].read(proposed) });

const toAction = (row: ActionRow): Action => ({
  ...proposalOf(actionTypeSchema.parse(row.actionType), row.proposed),
  agent: toAgentSummary(row.ticket.agentInstance),
  companyId: row.companyId,
  companyName: row.company.name,
  createdAt: row.createdAt.getTime(),
  decidedAt: row.decidedAt?.getTime() ?? null,
  feedback: row.feedback,
  id: row.id,
  policy: row.policy,
  status: row.status,
  ticketId: row.ticketId,
});

const ageSecondsOf = (createdAt: number, now: number): number =>
  Math.max(0, Math.floor((now - createdAt) / 1000));

const deciderName = async (db: Db, userId: string | null): Promise<string | null> => {
  if (userId === null) {
    return null;
  }

  const user = await db.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: userId },
  });

  return user ? (user.displayName ?? user.name) : null;
};

const listTicketActions = async (db: Db, ticketId: string): Promise<ReadonlyArray<Action>> => {
  const rows = await db.action.findMany({
    include: actionInclude,
    orderBy: { createdAt: "asc" },
    where: { ticketId },
  });

  return rows.map(toAction);
};

const getActionDetail = async (db: Db, actionId: string): Promise<ActionDetailResponse> => {
  const row = await db.action.findUnique({
    include: { ...actionInclude, ticket: { include: ticketInclude } },
    where: { id: actionId },
  });

  if (!row) {
    throw notFound();
  }

  const [rounds, decidedByName] = await Promise.all([
    listTicketActions(db, row.ticketId),
    deciderName(db, row.decidedByUserId),
  ]);

  const action = toAction(row);

  return {
    action: { ...action, decidedByName },
    ageSeconds: ageSecondsOf(action.createdAt, Date.now()),
    canRequestChanges: canReviseAfter(rounds.length),
    rounds,
    ticket: toTicket(row.ticket),
  };
};

/** The approval queue, oldest first. An Operator with no coverage sees every Company. */
const listPendingActions = async (
  db: Db,
  coverage: OperatorCoverage,
): Promise<ReadonlyArray<PendingAction>> => {
  const rows = await db.action.findMany({
    include: actionInclude,
    orderBy: { createdAt: "asc" },
    take: 100,
    where: {
      companyId: coverage.companies.length > 0 ? { in: [...coverage.companies] } : undefined,
      status: "pending",
      ticket:
        coverage.disciplines.length > 0
          ? { agentInstance: { template: { workerKind: { in: [...coverage.disciplines] } } } }
          : undefined,
    },
  });

  const now = Date.now();

  return rows.map((row) =>
    Object.assign(toAction(row), { ageSeconds: ageSecondsOf(row.createdAt.getTime(), now) }),
  );
};

const canRequestChanges = async (db: Db, ticketId: string): Promise<boolean> =>
  canReviseAfter(await db.action.count({ where: { ticketId } }));

export {
  actionIdFor,
  canRequestChanges,
  canRevise,
  getActionDetail,
  listPendingActions,
  listTicketActions,
  MAX_REVISIONS,
};
