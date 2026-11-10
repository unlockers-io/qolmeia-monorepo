import type { CompanyStatus, TicketStatus } from "@repo/db/enums";

/** The two agents a Customer chats with, each mounted at `/agents/<name>/<companyId>`. */
const CONVERSATION_AGENTS = ["correspondent", "planner"] as const;

type ConversationAgent = (typeof CONVERSATION_AGENTS)[number];

/** A Ticket in one of these keeps its Worker busy. */
const OPEN_TICKET_STATUSES = [
  "in_progress",
  "awaiting_approval",
] as const satisfies ReadonlyArray<TicketStatus>;

type OpenTicketStatus = (typeof OPEN_TICKET_STATUSES)[number];

type AgentDisplayStatus = "available" | "awaiting_approval" | "paused" | "working";

type OpenTicketSlim = {
  status: OpenTicketStatus;
  summary: string;
  ticketId: string;
};

type TeamMemberBase = {
  currentWork: ReadonlyArray<OpenTicketSlim>;
  displayName: string;
  hasPromptOverride: boolean;
  id: string;
  lifetimeDone: number;
  status: AgentDisplayStatus;
};

type TeamMemberNonWorker = TeamMemberBase & {
  role: ConversationAgent;
  templateId: null;
  templateName: null;
  workerKind: null;
};

type TeamMemberWorker = TeamMemberBase & {
  role: "worker";
  templateId: string;
  templateName: string;
  workerKind: string;
};

type TeamMemberView = TeamMemberNonWorker | TeamMemberWorker;

type TeamMemberDetailExtras = {
  capabilities: string;
  companyName: string;
  createdAt: number;
  promptOverride: string | null;
  promptOverrideUpdatedAt: number | null;
  templateSystemPrompt: string;
};

type TeamMemberDetailView = TeamMemberView & TeamMemberDetailExtras;

type HireableTemplate = {
  description: string;
  displayName: string;
  hiredCount: number;
  id: string;
  workerKind: string;
};

type CompanyOverview = {
  briefPercent: number;
  id: string;
  name: string;
  status: CompanyStatus;
};

type CompanyRoster = CompanyOverview & { members: ReadonlyArray<TeamMemberView> };

export { CONVERSATION_AGENTS, OPEN_TICKET_STATUSES };

export type {
  AgentDisplayStatus,
  CompanyOverview,
  CompanyRoster,
  ConversationAgent,
  HireableTemplate,
  OpenTicketSlim,
  OpenTicketStatus,
  TeamMemberDetailView,
  TeamMemberView,
};
