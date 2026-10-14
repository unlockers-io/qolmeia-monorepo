import type { CompanyStatus } from "@repo/db/enums";

type AgentDisplayStatus = "available" | "awaiting_approval" | "paused" | "working";

type OpenTicketSlim = {
  status: "awaiting_approval" | "in_progress";
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
  role: "correspondent" | "planner";
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

export type {
  AgentDisplayStatus,
  CompanyOverview,
  CompanyRoster,
  HireableTemplate,
  OpenTicketSlim,
  TeamMemberBase,
  TeamMemberDetailExtras,
  TeamMemberDetailView,
  TeamMemberNonWorker,
  TeamMemberView,
  TeamMemberWorker,
};
export type { CompanyStatus } from "@repo/db/enums";
