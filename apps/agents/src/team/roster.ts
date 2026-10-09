import type { Prisma, TicketStatus } from "@repo/db/worker";
import type {
  AgentDisplayStatus,
  HireableTemplate,
  OpenTicketSlim,
  TeamMemberDetailView,
  TeamMemberView,
} from "@repo/worker-api/contracts";

import type { Db } from "#/lib/db";
import { listEntitledTemplates } from "#/template/template";

const OPEN_TICKET_STATUSES = [
  "in_progress",
  "awaiting_approval",
] as const satisfies ReadonlyArray<TicketStatus>;

const rosterInclude = {
  _count: { select: { tickets: { where: { status: "done" } } } },
  template: { select: { displayName: true, workerKind: true } },
  tickets: {
    select: { id: true, status: true, title: true },
    where: { status: { in: [...OPEN_TICKET_STATUSES] } },
  },
} as const satisfies Prisma.AgentInstanceInclude;

type RosterRow = Prisma.AgentInstanceGetPayload<{ include: typeof rosterInclude }>;

const isOpenStatus = (status: TicketStatus): status is OpenTicketSlim["status"] =>
  OPEN_TICKET_STATUSES.some((open) => open === status);

const displayStatus = (
  row: Pick<RosterRow, "status">,
  currentWork: ReadonlyArray<OpenTicketSlim>,
): AgentDisplayStatus => {
  if (row.status === "paused") {
    return "paused";
  }
  if (currentWork.some((ticket) => ticket.status === "in_progress")) {
    return "working";
  }
  if (currentWork.some((ticket) => ticket.status === "awaiting_approval")) {
    return "awaiting_approval";
  }
  return "available";
};

const projectMember = (row: RosterRow): TeamMemberView => {
  const currentWork = row.tickets.flatMap((ticket) =>
    isOpenStatus(ticket.status)
      ? [{ status: ticket.status, summary: ticket.title, ticketId: ticket.id }]
      : [],
  );
  const base = {
    currentWork,
    displayName: row.displayName,
    hasPromptOverride: row.promptOverride !== null,
    id: row.id,
    lifetimeDone: row._count.tickets,
    status: displayStatus(row, currentWork),
  };
  if (row.role !== "worker") {
    return { ...base, role: row.role, templateId: null, templateName: null, workerKind: null };
  }
  const workerKind = row.template?.workerKind ?? "";
  if (row.templateId === null || row.templateId === "" || workerKind === "") {
    throw new Error(`worker ${row.id} missing template_id or worker_kind`);
  }
  return {
    ...base,
    role: "worker",
    templateId: row.templateId,
    templateName: row.template?.displayName ?? workerKind,
    workerKind,
  };
};

const sortRoster = (members: ReadonlyArray<TeamMemberView>): Array<TeamMemberView> => {
  const correspondents = members.filter((member) => member.role === "correspondent");
  const others = members
    .filter((member) => member.role !== "correspondent")
    .toSorted((a, b) =>
      a.currentWork.length === b.currentWork.length
        ? a.displayName.localeCompare(b.displayName, "pt-BR")
        : b.currentWork.length - a.currentWork.length,
    );
  return [...correspondents, ...others];
};

const listTeamRosters = async (
  db: Db,
  companyIds: ReadonlyArray<string>,
): Promise<Map<string, Array<TeamMemberView>>> => {
  const ids = [...new Set(companyIds)].filter(Boolean);
  const rows =
    ids.length === 0
      ? []
      : await db.agentInstance.findMany({
          include: rosterInclude,
          orderBy: { createdAt: "asc" },
          where: { companyId: { in: ids } },
        });
  const rosters = new Map<string, Array<TeamMemberView>>(ids.map((id) => [id, []]));
  for (const row of rows) {
    rosters.get(row.companyId)?.push(projectMember(row));
  }
  return new Map([...rosters].map(([companyId, members]) => [companyId, sortRoster(members)]));
};

const getTeamRoster = async (db: Db, companyId: string): Promise<Array<TeamMemberView>> => {
  const rosters = await listTeamRosters(db, [companyId]);
  return rosters.get(companyId) ?? [];
};

const getTeamMember = async (
  db: Db,
  companyId: string,
  agentInstanceId: string,
): Promise<TeamMemberView | null> => {
  const row = await db.agentInstance.findFirst({
    include: rosterInclude,
    where: { companyId, id: agentInstanceId },
  });
  return row ? projectMember(row) : null;
};

const getMemberDetail = async (
  db: Db,
  companyId: string,
  agentInstanceId: string,
): Promise<TeamMemberDetailView | null> => {
  const row = await db.agentInstance.findFirst({
    include: {
      ...rosterInclude,
      company: { select: { name: true } },
      template: {
        select: { description: true, displayName: true, systemPrompt: true, workerKind: true },
      },
    },
    where: { companyId, id: agentInstanceId },
  });
  if (!row) {
    return null;
  }
  const edited = await db.activityLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: { companyId, refId: agentInstanceId, type: "MEMBER_PROMPT_EDITED" },
  });
  return {
    ...projectMember(row),
    capabilities: row.template?.description ?? "",
    companyName: row.company.name,
    createdAt: row.createdAt.getTime(),
    promptOverride: row.promptOverride,
    promptOverrideUpdatedAt: edited?.createdAt.getTime() ?? null,
    templateSystemPrompt: row.template?.systemPrompt ?? "",
  };
};

const getCatalogue = async (db: Db, companyId: string): Promise<Array<HireableTemplate>> => {
  const [templates, counts] = await Promise.all([
    listEntitledTemplates(db, companyId),
    db.agentInstance.groupBy({
      _count: { _all: true },
      by: ["templateId"],
      where: { companyId, role: "worker", templateId: { not: null } },
    }),
  ]);
  const hiredByTemplate = new Map(counts.map((row) => [row.templateId, row._count._all]));
  return templates.map((template) => ({
    description: template.description,
    displayName: template.displayName,
    hiredCount: hiredByTemplate.get(template.id) ?? 0,
    id: template.id,
    workerKind: template.workerKind,
  }));
};

const normalizeDisplayName = (value: string): string => value.toLocaleLowerCase("pt-BR");

const nextDisplayName = (base: string, existing: ReadonlyArray<string>): string => {
  const taken = new Set(existing.map(normalizeDisplayName));
  if (!taken.has(normalizeDisplayName(base))) {
    return base;
  }
  for (let index = 2; index < 1000; index++) {
    const candidate = `${base} #${index}`;
    if (!taken.has(normalizeDisplayName(candidate))) {
      return candidate;
    }
  }
  throw new Error(`nextDisplayName: exhausted candidates for "${base}"`);
};

export {
  getCatalogue,
  getMemberDetail,
  getTeamMember,
  getTeamRoster,
  listTeamRosters,
  nextDisplayName,
};
