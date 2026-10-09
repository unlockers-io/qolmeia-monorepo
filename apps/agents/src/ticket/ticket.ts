import type { Prisma, TicketStatus } from "@repo/db/worker";
import type { AgentSummary, Template, Ticket, TicketListRow } from "@repo/worker-api/contracts";

import type { Db } from "#/lib/db";
import { toRecordOrNull } from "#/lib/records";
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
  agentInstanceId: row.agentInstanceId,
  brief: row.brief,
  companyId: row.companyId,
  companyName: row.company.name,
  id: row.id,
  result: toRecordOrNull(row.result),
  status: row.status,
  workflowId: row.workflowId,
});

const loadTicket = async (db: Db, id: string): Promise<Ticket | null> => {
  const row = await db.ticket.findUnique({ include: ticketInclude, where: { id } });
  return row ? toTicket(row) : null;
};

const listTickets = async (
  db: Db,
  options: { companyId?: string; limit?: number; status?: TicketStatus },
): Promise<ReadonlyArray<TicketListRow>> => {
  const rows = await db.ticket.findMany({
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(options.limit ?? 50, 200),
    where: { companyId: options.companyId, status: options.status },
  });
  return rows.map((row) =>
    Object.assign(toTicket(row), {
      createdAt: row.createdAt.getTime(),
      origin: row.origin,
      title: row.title,
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
  const template = await getTemplate(db, templateId);
  if (!template) {
    throw new Error(`template ${templateId} not found`);
  }
  return { agentInstance, template };
};

export { agentSummarySelect, listTickets, loadInstanceWithTemplate, loadTicket, toAgentSummary };
export type { InstanceWithTemplate };
