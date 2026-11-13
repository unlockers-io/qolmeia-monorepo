import { apiCall, type ApiGet } from "@repo/worker-api";
import {
  type ActivityCategory,
  type DecisionInput,
  type invitationInputSchema,
  type OperatorCoverage,
  type operatorMemberPatchSchema,
  SKILL_IDS,
  type SkillId,
  type TemplateInput,
  type TemplateStatus,
} from "@repo/worker-api/contracts";
import { BACKOFFICE } from "@repo/worker-api/endpoints";
import { z } from "zod";

const ACTIVITY_PAGE_SIZE = 50;

const templateKeys = {
  all: ["templates"] as const,
  skills: ["template-skills"] as const,
};

const getTickets = (get: ApiGet, limit: number) => get(BACKOFFICE.tickets, { query: { limit } });

const getTicket = (get: ApiGet, id: string) => get(BACKOFFICE.ticket, { params: { id } });

const getPendingActions = (get: ApiGet) => get(BACKOFFICE.pendingActions);

const getAction = (get: ApiGet, id: string) => get(BACKOFFICE.action, { params: { id } });

const decide = (id: string, input: DecisionInput) =>
  apiCall(BACKOFFICE.decide, { body: input, params: { id } });

const getCompanies = (get: ApiGet) => get(BACKOFFICE.companies);

const inviteCustomer = (companyId: string, input: z.input<typeof invitationInputSchema>) =>
  apiCall(BACKOFFICE.inviteCustomer, { body: input, params: { companyId } });

const getCoverage = (get: ApiGet) => get(BACKOFFICE.coverage);

const saveCoverage = (coverage: OperatorCoverage) =>
  apiCall(BACKOFFICE.saveCoverage, { body: coverage });

type ActivityQuery = {
  before?: number;
  category: ActivityCategory | undefined;
  limit: number;
};

const getActivity = (get: ApiGet, query: ActivityQuery) => get(BACKOFFICE.activity, { query });

const getMember = (get: ApiGet, companyId: string, memberId: string) =>
  get(BACKOFFICE.member, { params: { companyId, id: memberId } });

const patchMember = (
  companyId: string,
  memberId: string,
  patch: z.input<typeof operatorMemberPatchSchema>,
) => apiCall(BACKOFFICE.patchMember, { body: patch, params: { companyId, id: memberId } });

const skillIdSchema = z.enum(SKILL_IDS);

const isSkillId = (id: string): id is SkillId => skillIdSchema.safeParse(id).success;

const getSkillCatalog = async (get: ApiGet) => {
  const { items } = await get(BACKOFFICE.skills);

  return items;
};

const getTemplates = (get: ApiGet) => get(BACKOFFICE.templates);

const getTemplate = (get: ApiGet, id: string) => get(BACKOFFICE.template, { params: { id } });

const createTemplate = (input: TemplateInput) =>
  apiCall(BACKOFFICE.createTemplate, { body: input });

const updateTemplate = (id: string, input: TemplateInput) =>
  apiCall(BACKOFFICE.updateTemplate, { body: input, params: { id } });

const setTemplateStatus = (id: string, status: TemplateStatus) =>
  apiCall(BACKOFFICE.setTemplateStatus, { body: { status }, params: { id } });

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
