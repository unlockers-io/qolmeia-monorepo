import type { Prisma } from "@repo/db/worker";
import type { Action, ActionDetail, OperatorCoverage } from "@repo/worker-api/contracts";

import { actionTypeSchema } from "#/action/action-types";
import type { Db } from "#/lib/db";
import { toRecord, type JsonRecord } from "#/lib/records";
import { agentSummarySelect, toAgentSummary } from "#/ticket/ticket";

const MAX_REVISIONS = 3;

const canRevise = (round: number): boolean => round < MAX_REVISIONS;

const actionIdFor = (ticketId: string, round: number): string => `${ticketId}-r${round}`;

const actionInclude = {
  company: { select: { name: true } },
  ticket: { select: { agentInstance: { select: agentSummarySelect } } },
} as const satisfies Prisma.ActionInclude;

const toAction = (row: Prisma.ActionGetPayload<{ include: typeof actionInclude }>): Action => ({
  actionType: actionTypeSchema.parse(row.actionType),
  agent: toAgentSummary(row.ticket.agentInstance),
  companyId: row.companyId,
  companyName: row.company.name,
  createdAt: row.createdAt.getTime(),
  decidedAt: row.decidedAt?.getTime() ?? null,
  decidedByUserId: row.decidedByUserId,
  feedback: row.feedback,
  id: row.id,
  policy: row.policy,
  proposed: toRecord(row.proposed),
  status: row.status,
  ticketId: row.ticketId,
});

const deciderName = async (db: Db, decidedById: string | null): Promise<string | null> => {
  if (decidedById === null || decidedById === "") {
    return null;
  }
  const [user, agent] = await Promise.all([
    db.user.findUnique({ select: { displayName: true, name: true }, where: { id: decidedById } }),
    db.agentInstance.findUnique({ select: { displayName: true }, where: { id: decidedById } }),
  ]);
  if (user) {
    return user.displayName ?? user.name;
  }
  return agent ? `Cliente, pelo ${agent.displayName}` : null;
};

const getAction = async (db: Db, actionId: string): Promise<ActionDetail | null> => {
  const row = await db.action.findUnique({ include: actionInclude, where: { id: actionId } });
  if (!row) {
    return null;
  }
  return { ...toAction(row), decidedByName: await deciderName(db, row.decidedByUserId) };
};

const listPendingActions = async (
  db: Db,
  scope: { companyId: string } | OperatorCoverage,
): Promise<ReadonlyArray<Action>> => {
  const where: Prisma.ActionWhereInput =
    "companyId" in scope
      ? { companyId: scope.companyId }
      : {
          companyId: scope.companies.length > 0 ? { in: [...scope.companies] } : undefined,
          ticket:
            scope.disciplines.length > 0
              ? { agentInstance: { template: { workerKind: { in: [...scope.disciplines] } } } }
              : undefined,
        };
  const rows = await db.action.findMany({
    include: actionInclude,
    orderBy: { createdAt: "asc" },
    take: 100,
    where: { ...where, status: "pending" },
  });
  return rows.map(toAction);
};

const listActions = async (db: Db, companyId?: string): Promise<ReadonlyArray<Action>> => {
  const rows = await db.action.findMany({
    include: actionInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
    where: { companyId },
  });
  return rows.map(toAction);
};

const listTicketActions = async (db: Db, ticketId: string): Promise<ReadonlyArray<Action>> => {
  const rows = await db.action.findMany({
    include: actionInclude,
    orderBy: { createdAt: "asc" },
    where: { ticketId },
  });
  return rows.map(toAction);
};

const getProposedPayload = async (db: Db, actionId: string): Promise<JsonRecord> => {
  const { proposed } = await db.action.findUniqueOrThrow({
    select: { proposed: true },
    where: { id: actionId },
  });
  return toRecord(proposed);
};

const canRequestChanges = async (db: Db, ticketId: string): Promise<boolean> =>
  canRevise((await db.action.count({ where: { ticketId } })) - 1);

export {
  actionIdFor,
  canRequestChanges,
  canRevise,
  getAction,
  getProposedPayload,
  listActions,
  listPendingActions,
  listTicketActions,
  MAX_REVISIONS,
};
