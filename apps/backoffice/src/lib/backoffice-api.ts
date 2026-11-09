import { type apiGet, apiSend } from "@repo/worker-api";
import {
  type ActionDetailResponse,
  type ActivityCategory,
  type ActivityResponse,
  type CompaniesResponse,
  type CoverageResponse,
  type CustomerInvitationResponse,
  type DecisionInput,
  type invitationInputSchema,
  type MemberDetailResponse,
  type OperatorCoverage,
  type operatorMemberPatchSchema,
  type PendingActionsResponse,
  SKILL_IDS,
  type SkillCatalogResponse,
  type SkillId,
  type TemplateInput,
  type TemplateResponse,
  type TemplatesResponse,
  type TemplateStatus,
  type TicketDetailResponse,
  type TicketsResponse,
} from "@repo/worker-api/contracts";
import { z } from "zod";

type Get = typeof apiGet;

const ACTIVITY_PAGE_SIZE = 50;

const COVERAGE_PATH = "/api/backoffice/assignments/me";

const TEMPLATES_PATH = "/api/backoffice/templates";

const templateKeys = {
  all: ["templates"] as const,
  skills: ["template-skills"] as const,
};

const memberPath = (companyId: string, memberId: string): string =>
  `/api/backoffice/teams/${companyId}/members/${memberId}`;

const actionPath = (id: string): string => `/api/backoffice/actions/${id}`;

const templatePath = (id: string): string => `${TEMPLATES_PATH}/${id}`;

const getTickets = (get: Get, limit: number) =>
  get<TicketsResponse>(`/api/backoffice/tickets?limit=${limit}`);

const getTicket = (get: Get, id: string) =>
  get<TicketDetailResponse>(`/api/backoffice/tickets/${id}`);

const getPendingActions = (get: Get) => get<PendingActionsResponse>("/api/backoffice/actions");

const getAction = (get: Get, id: string) => get<ActionDetailResponse>(actionPath(id));

const decide = (id: string, input: DecisionInput) =>
  apiSend("POST", `${actionPath(id)}/decide`, input);

const getCompanies = (get: Get) => get<CompaniesResponse>("/api/backoffice/companies");

const inviteCustomer = (companyId: string, input: z.input<typeof invitationInputSchema>) =>
  apiSend<CustomerInvitationResponse>(
    "POST",
    `/api/backoffice/companies/${companyId}/invitations`,
    input,
  );

const getCoverage = (get: Get) => get<CoverageResponse>(COVERAGE_PATH);

const saveCoverage = (coverage: OperatorCoverage) => apiSend("PUT", COVERAGE_PATH, coverage);

type ActivityQuery = {
  before?: number;
  category: ActivityCategory | undefined;
  limit: number;
};

const getActivity = (get: Get, { before, category, limit }: ActivityQuery) => {
  const query = new URLSearchParams({ limit: String(limit) });

  if (before !== undefined) {
    query.set("before", String(before));
  }

  if (category !== undefined) {
    query.set("category", category);
  }

  return get<ActivityResponse>(`/api/backoffice/activity?${query.toString()}`);
};

const getMember = (get: Get, companyId: string, memberId: string) =>
  get<MemberDetailResponse>(memberPath(companyId, memberId));

const patchMember = (
  companyId: string,
  memberId: string,
  patch: z.input<typeof operatorMemberPatchSchema>,
) => apiSend<MemberDetailResponse>("PATCH", memberPath(companyId, memberId), patch);

const skillIdSchema = z.enum(SKILL_IDS);

const isSkillId = (id: string): id is SkillId => skillIdSchema.safeParse(id).success;

const getSkillCatalog = async (get: Get) => {
  const { items } = await get<SkillCatalogResponse>("/api/backoffice/skills");

  return items;
};

const getTemplates = (get: Get) => get<TemplatesResponse>(TEMPLATES_PATH);

const getTemplate = (get: Get, id: string) => get<TemplateResponse>(templatePath(id));

const createTemplate = (input: TemplateInput) =>
  apiSend<TemplateResponse>("POST", TEMPLATES_PATH, input);

const updateTemplate = (id: string, input: TemplateInput) =>
  apiSend<TemplateResponse>("PATCH", templatePath(id), input);

const setTemplateStatus = (id: string, status: TemplateStatus) =>
  apiSend<TemplateResponse>("PATCH", `${templatePath(id)}/status`, { status });

export {
  ACTIVITY_PAGE_SIZE,
  createTemplate,
  decide,
  getAction,
  getActivity,
  getCompanies,
  getCoverage,
  getMember,
  getPendingActions,
  getSkillCatalog,
  getTemplate,
  getTemplates,
  getTicket,
  getTickets,
  inviteCustomer,
  isSkillId,
  patchMember,
  saveCoverage,
  setTemplateStatus,
  templateKeys,
  updateTemplate,
};
