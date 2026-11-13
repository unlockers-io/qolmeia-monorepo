import type { Prisma } from "@repo/db/worker";
import {
  ticketResultSchema,
  type AgentSummary,
  type Template,
  type Ticket,
  type TicketListRow,
} from "@repo/worker-api/contracts";

import type { Db } from "#/lib/db";
import { notFound } from "#/lib/errors";
import { getTemplate } from "#/template/template";

type InstanceWithTemplate = {
  agentInstance: { id: string; promptOverride: string | null };
  template: Template;
};

const agentSummarySelect = {
  displayName: true,
  role: true,
  template: { select: { workerKind: true } },
} as const satisfies Prisma.AgentInstanceSelect;

const toAgentSummary = (
  row: Prisma.AgentInstanceGetPayload<{ select: typeof agentSummarySelect }>,
): AgentSummary => ({
  name: row.displayName,
  role: row.role,
  workerKind: row.template?.workerKind ?? null,
});

const ticketInclude = {
  agentInstance: { select: agentSummarySelect },
  company: { select: { name: true } },
} as const satisfies Prisma.TicketInclude;

const toTicket = (row: Prisma.TicketGetPayload<{ include: typeof ticketInclude }>): Ticket => ({
  agent: toAgentSummary(row.agentInstance),
  brief: row.brief,
  companyId: row.companyId,
  companyName: row.company.name,
  id: row.id,
  result: row.result === null ? null : ticketResultSchema.parse(row.result),
  status: row.status,
  title: row.title,
});

const loadTicket = async (db: Db, id: string): Promise<Ticket> => {
  const row = await db.ticket.findUnique({ include: ticketInclude, where: { id } });

  if (!row) {
    throw notFound();
  }

  return toTicket(row);
};

const listTickets = async (db: Db, limit: number): Promise<ReadonlyArray<TicketListRow>> => {
  const rows = await db.ticket.findMany({
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) =>
    Object.assign(toTicket(row), {
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    }),
  );
};

const loadInstanceWithTemplate = async (
  db: Db,
  agentInstanceId: string,
): Promise<InstanceWithTemplate> => {
  const agentInstance = await db.agentInstance.findUnique({
    select: { id: true, promptOverride: true, templateId: true },
    where: { id: agentInstanceId },
  });

  const templateId = agentInstance?.templateId ?? "";

  if (!agentInstance || templateId === "") {
    throw new Error(`agent_instance ${agentInstanceId} is not linked to a template`);
  }

  return { agentInstance, template: await getTemplate(db, templateId) };
};

export {
  agentSummarySelect,
  listTickets,
  loadInstanceWithTemplate,
  loadTicket,
  ticketInclude,
  toAgentSummary,
  toTicket,
};
