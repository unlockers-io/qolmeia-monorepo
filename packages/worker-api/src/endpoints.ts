import type { z } from "zod";

import { briefPatchSchema } from "./brief";
import { decisionInputSchema } from "./contracts/actions";
import type { ActivityCategory } from "./contracts/activity";
import {
  companyInputSchema,
  coverageInputSchema,
  invitationInputSchema,
  operatorMemberPatchSchema,
  templateInputSchema,
  templateStatusInputSchema,
  type ActionDetailResponse,
  type ActivityResponse,
  type CompaniesResponse,
  type CompanyCreatedResponse,
  type CoverageResponse,
  type CustomerInvitationResponse,
  type OperatorCoverage,
  type PendingActionsResponse,
  type SignupState,
  type SkillCatalogResponse,
  type TemplateResponse,
  type TemplatesResponse,
  type TicketDetailResponse,
  type TicketsResponse,
} from "./contracts/backoffice";
import {
  confirmTeamInputSchema,
  deleteAssetsInputSchema,
  hireInputSchema,
  memberPatchSchema,
  type BrandAssetResponse,
  type BrandAssetsResponse,
  type CatalogueResponse,
  type CompanyResponse,
  type ConfirmTeamResponse,
  type CustomerActivityResponse,
  type DeleteAssetsResponse,
  type LibraryAssetsResponse,
  type MemberDetailResponse,
  type MemberResponse,
  type TeamResponse,
  type UploadResponse,
} from "./contracts/customer";
import type { MeResponse } from "./contracts/me";

type Method = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type BodySchema = z.ZodType<object>;

/** `"form"` is a multipart body the handler reads itself. */
type EndpointBody = BodySchema | "form" | null;

type Endpoint<
  Response = unknown,
  Verb extends Method = Method,
  Path extends string = string,
  Body extends EndpointBody = EndpointBody,
  Query extends Record<string, number | string> = Record<string, number | string>,
> = {
  body: Body;
  method: Verb;
  path: Path;
  status: 200 | 201;
  /** Type-only: what the Worker answers and what a query string may carry. */
  types?: { query: Query; response: Response };
};

type NoQuery = Record<never, never>;

const get =
  <Response, Query extends Record<string, number | string> = NoQuery>() =>
  <const Path extends string>(path: Path): Endpoint<Response, "GET", Path, null, Query> => ({
    body: null,
    method: "GET",
    path,
    status: 200,
  });

const send =
  <Response>() =>
  <
    const Verb extends Exclude<Method, "GET">,
    const Path extends string,
    Body extends EndpointBody = null,
  >(
    method: Verb,
    path: Path,
    body: Body,
    status: 200 | 201 = 200,
  ): Endpoint<Response, Verb, Path, Body, NoQuery> => ({ body, method, path, status });

type OkResponse = { ok: true };

const SIGNUP = get<SignupState>()("/api/signup");

const ME = get<MeResponse>()("/api/me");

const BACKOFFICE = {
  action: get<ActionDetailResponse>()("/api/backoffice/actions/:id"),
  activity: get<
    ActivityResponse,
    { before?: number; category?: ActivityCategory; limit?: number }
  >()("/api/backoffice/activity"),
  companies: get<CompaniesResponse>()("/api/backoffice/companies"),
  coverage: get<CoverageResponse>()("/api/backoffice/assignments/me"),
  createCompany: send<CompanyCreatedResponse>()(
    "POST",
    "/api/backoffice/companies",
    companyInputSchema,
    201,
  ),
  createTemplate: send<TemplateResponse>()(
    "POST",
    "/api/backoffice/templates",
    templateInputSchema,
    201,
  ),
  decide: send<OkResponse>()("POST", "/api/backoffice/actions/:id/decide", decisionInputSchema),
  inviteCustomer: send<CustomerInvitationResponse>()(
    "POST",
    "/api/backoffice/companies/:companyId/invitations",
    invitationInputSchema,
    201,
  ),
  member: get<MemberDetailResponse>()("/api/backoffice/teams/:companyId/members/:id"),
  patchMember: send<MemberDetailResponse>()(
    "PATCH",
    "/api/backoffice/teams/:companyId/members/:id",
    operatorMemberPatchSchema,
  ),
  pendingActions: get<PendingActionsResponse>()("/api/backoffice/actions"),
  saveCoverage: send<{ assigned: OperatorCoverage }>()(
    "PUT",
    "/api/backoffice/assignments/me",
    coverageInputSchema,
  ),
  setTemplateStatus: send<TemplateResponse>()(
    "PATCH",
    "/api/backoffice/templates/:id/status",
    templateStatusInputSchema,
  ),
  skills: get<SkillCatalogResponse>()("/api/backoffice/skills"),
  template: get<TemplateResponse>()("/api/backoffice/templates/:id"),
  templates: get<TemplatesResponse>()("/api/backoffice/templates"),
  ticket: get<TicketDetailResponse>()("/api/backoffice/tickets/:id"),
  tickets: get<TicketsResponse, { limit?: number }>()("/api/backoffice/tickets"),
  updateTemplate: send<TemplateResponse>()(
    "PATCH",
    "/api/backoffice/templates/:id",
    templateInputSchema,
  ),
};

const CUSTOMER = {
  activity: get<CustomerActivityResponse, { limit?: number }>()("/api/me/activity"),
  assets: get<LibraryAssetsResponse, { limit?: number }>()("/api/me/assets"),
  brandAssets: get<BrandAssetsResponse>()("/api/me/brand-assets"),
  catalogue: get<CatalogueResponse>()("/api/me/catalogue"),
  company: get<CompanyResponse>()("/api/me/company"),
  confirmTeam: send<ConfirmTeamResponse>()("POST", "/api/me/team/confirm", confirmTeamInputSchema),
  deleteAssets: send<DeleteAssetsResponse>()(
    "POST",
    "/api/me/assets/delete",
    deleteAssetsInputSchema,
  ),
  deleteBrandAsset: send<OkResponse>()("DELETE", "/api/me/brand-assets/:id", null),
  hireMember: send<MemberResponse>()("POST", "/api/me/team/hire", hireInputSchema),
  member: get<MemberDetailResponse>()("/api/me/team/members/:id"),
  patchCompany: send<CompanyResponse>()("PATCH", "/api/me/company", briefPatchSchema),
  patchMember: send<MemberResponse>()("PATCH", "/api/me/team/members/:id", memberPatchSchema),
  pauseMember: send<MemberResponse>()("POST", "/api/me/team/members/:id/pause", null),
  resumeMember: send<MemberResponse>()("POST", "/api/me/team/members/:id/resume", null),
  team: get<TeamResponse>()("/api/me/team"),
  /** A server-sent event stream of `TEAM_EVENT_TYPES`, not a JSON answer. */
  teamEvents: get<never>()("/api/me/team/events"),
  uploadBrandAsset: send<BrandAssetResponse>()("POST", "/api/me/brand-assets", "form"),
  uploadChatFile: send<UploadResponse>()("POST", "/api/me/uploads", "form"),
};

type PathParams<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? Param | PathParams<`/${Rest}`>
  : Path extends `${string}:${infer Param}`
    ? Param
    : never;

type ResponseOf<Target extends Endpoint> = NonNullable<Target["types"]>["response"];

type QueryOf<Target extends Endpoint> = NonNullable<Target["types"]>["query"];

type ParamsOf<Target extends Endpoint> = Record<PathParams<Target["path"]>, string>;

export { BACKOFFICE, CUSTOMER, ME, SIGNUP };

export type { BodySchema, Endpoint, NoQuery, ParamsOf, PathParams, QueryOf, ResponseOf };
