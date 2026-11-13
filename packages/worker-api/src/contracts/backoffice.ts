import {
  type ActionPolicy,
  type ActionStatus,
  type AgentRole,
  TemplateStatus,
  type TicketStatus,
} from "@repo/db/enums";
import { z } from "zod";

import {
  actionPolicySchema,
  actionTypeSchema,
  type ActionType,
  type ProposedOf,
  type TicketResult,
} from "./actions";
import type { CompanyRoster } from "./agents";
import { memberPatchSchema } from "./customer";
import { SKILL_IDS, type SkillId } from "./skills";

type WireValue =
  | boolean
  | number
  | string
  | null
  | ReadonlyArray<WireValue>
  | { readonly [key: string]: WireValue };

type WireObject = Readonly<Record<string, WireValue>>;

type AgentSummary = {
  name: string;
  role: AgentRole;
  workerKind: string | null;
};

type Ticket = {
  agent: AgentSummary;
  brief: string;
  companyId: string;
  companyName: string;
  id: string;
  result: TicketResult | null;
  status: TicketStatus;
  title: string;
};

type TicketListRow = Ticket & {
  createdAt: number;
  updatedAt: number;
};

type ActionFields = {
  agent: AgentSummary;
  companyId: string;
  companyName: string;
  createdAt: number;
  decidedAt: number | null;
  feedback: string | null;
  id: string;
  policy: ActionPolicy;
  status: ActionStatus;
  ticketId: string;
};

type ActionOf<Type extends ActionType> = ActionFields & {
  actionType: Type;
  proposed: ProposedOf<Type>;
};

type Action = { [Type in ActionType]: ActionOf<Type> }[ActionType];

type PendingAction = Action & { ageSeconds: number };

type ActivityEntry = {
  companyId: string;
  companyName: string;
  createdAt: number;
  id: string;
  payload: WireObject | null;
  summary: string;
  type: string;
};

type TicketsResponse = { items: ReadonlyArray<TicketListRow> };

type PendingActionsResponse = { items: ReadonlyArray<PendingAction> };

type ActivityResponse = { items: ReadonlyArray<ActivityEntry> };

type TicketDetailResponse = { actions: ReadonlyArray<Action>; ticket: Ticket };

type ActionDetail = Action & { decidedByName: string | null };

type ActionDetailResponse = {
  action: ActionDetail;
  ageSeconds: number;
  canRequestChanges: boolean;
  rounds: ReadonlyArray<Action>;
  ticket: Ticket;
};

type OperatorCoverage = {
  companies: ReadonlyArray<string>;
  disciplines: ReadonlyArray<string>;
};

type CoverageOption = { id: string; name: string };

type CoverageResponse = {
  assigned: OperatorCoverage;
  options: {
    companies: ReadonlyArray<CoverageOption>;
    disciplines: ReadonlyArray<CoverageOption>;
  };
};

const coverageInputSchema = z.object({
  companies: z.array(z.string().min(1)).max(1000),
  disciplines: z.array(z.string().min(1)).max(100),
});

type Template = {
  defaultActionType: ActionType;
  defaultPolicies: Partial<Record<ActionType, ActionPolicy>>;
  description: string;
  displayName: string;
  id: string;
  model: string;
  skillIds: ReadonlyArray<string>;
  status: TemplateStatus;
  systemPrompt: string;
  workerKind: string;
};

const TEMPLATE_MAX_LENGTH = {
  description: 2000,
  displayName: 120,
  model: 160,
  systemPrompt: 20_000,
  workerKind: 80,
} as const;

const DEFAULT_ACTION_TYPE = "worker_deliverable" satisfies ActionType;

const templateInputSchema = z.object({
  defaultActionType: actionTypeSchema.default(DEFAULT_ACTION_TYPE),
  defaultPolicies: z.partialRecord(actionTypeSchema, actionPolicySchema).default({}),
  description: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH.description),
  displayName: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH.displayName),
  model: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH.model),
  skillIds: z.array(z.enum(SKILL_IDS)),
  systemPrompt: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH.systemPrompt),
  workerKind: z.string().trim().min(1).max(TEMPLATE_MAX_LENGTH.workerKind),
});

type TemplateInput = z.output<typeof templateInputSchema>;

const templateStatusInputSchema = z.object({ status: z.enum(TemplateStatus) });

type SkillCatalogEntry = {
  displayName: string;
  id: SkillId;
};

const COMPANY_NAME_MAX_LENGTH = 120;

const COMPANY_SLUG_MAX_LENGTH = 80;

const companyInputSchema = z.object({
  name: z.string().trim().min(1).max(COMPANY_NAME_MAX_LENGTH),
  slug: z
    .string()
    .min(1)
    .max(COMPANY_SLUG_MAX_LENGTH)
    .regex(/^[a-z0-9\-]+$/v, "slug must be lowercase alphanumeric or dashes"),
});

const EMAIL_MAX_LENGTH = 254;

const invitationInputSchema = z.object({ email: z.email().max(EMAIL_MAX_LENGTH) });

type CustomerInvitation = {
  email: string;
  expiresAt: number;
  id: string;
};

type CustomerInvitationResponse = { invitation: CustomerInvitation };

/** An Operator either sets a Worker's status or edits it, never both in one request. */
const operatorMemberPatchSchema = z.union([
  z.strictObject({ status: z.enum(["active", "paused"]) }),
  z.strictObject(memberPatchSchema.shape),
]);

type CompaniesResponse = { companies: ReadonlyArray<CompanyRoster> };

type CompanyCreatedResponse = { company: { id: string; name: string; slug: string } };

type TemplatesResponse = { items: ReadonlyArray<Template> };

type TemplateResponse = { template: Template };

type SkillCatalogResponse = { items: ReadonlyArray<SkillCatalogEntry> };

type SignupState = { open: boolean };

export {
  COMPANY_NAME_MAX_LENGTH,
  COMPANY_SLUG_MAX_LENGTH,
  companyInputSchema,
  coverageInputSchema,
  DEFAULT_ACTION_TYPE,
  EMAIL_MAX_LENGTH,
  invitationInputSchema,
  operatorMemberPatchSchema,
  TEMPLATE_MAX_LENGTH,
  templateInputSchema,
  templateStatusInputSchema,
};

export type {
  Action,
  ActionDetail,
  ActionDetailResponse,
  ActionOf,
  ActivityEntry,
  ActivityResponse,
  AgentSummary,
  CompaniesResponse,
  CompanyCreatedResponse,
  CoverageOption,
  CoverageResponse,
  CustomerInvitation,
  CustomerInvitationResponse,
  OperatorCoverage,
  PendingAction,
  PendingActionsResponse,
  SignupState,
  SkillCatalogEntry,
  SkillCatalogResponse,
  Template,
  TemplateInput,
  TemplateResponse,
  TemplatesResponse,
  Ticket,
  TicketDetailResponse,
  TicketListRow,
  TicketsResponse,
  WireObject,
};
