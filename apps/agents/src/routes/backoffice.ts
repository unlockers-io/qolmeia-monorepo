import { Prisma } from "@repo/db/worker";
import type {
  ActionDetailResponse,
  ActionsResponse,
  ActivityResponse,
  CompanyRoster,
  CoverageResponse,
  SkillCatalogResponse,
  TemplateInput,
  TemplateResponse,
  TemplatesResponse,
  TicketDetailResponse,
  TicketsResponse,
  TicketStatus,
} from "@repo/worker-api/contracts";
import { Hono } from "hono";
import { z } from "zod";

import {
  canRequestChanges,
  getAction,
  listActions,
  listPendingActions,
  listTicketActions,
} from "#/action/action";
import { ACTIVITY_CATEGORIES, listActivity } from "#/activity/log";
import { listCompaniesOverview } from "#/company/company";
import { createOrganization } from "#/company/organization";
import { decisionEventType } from "#/jobs/decision-event";
import { requireStaffSession, type ValidatedSession } from "#/lib/auth";
import { dbPerRequest, type DbVariables } from "#/lib/db";
import { parsePositiveInt, parseTimestamp } from "#/lib/pagination";
import { getCoverage, getCoverageOptions, setCoverage } from "#/operator/assignment";
import { isKnownSkill, listSkillCatalog } from "#/skills/registry";
import { TeamError } from "#/team/errors";
import { backofficeTeamMemberPatchSchema, setMemberStatus, updateMember } from "#/team/members";
import { getMemberDetail, getTeamRoster, listTeamRosters } from "#/team/roster";
import {
  createTemplate,
  getTemplate,
  listAllTemplates,
  setTemplateStatus,
  updateTemplate,
} from "#/template/template";
import { listTickets, loadTicket } from "#/ticket/ticket";

type Vars = DbVariables & { session: ValidatedSession };

const backofficeRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

backofficeRoutes.use("*", requireStaffSession);
backofficeRoutes.use("*", dbPerRequest);

const TICKET_STATUSES: ReadonlyArray<TicketStatus> = [
  "awaiting_approval",
  "blocked",
  "cancelled",
  "done",
  "in_progress",
  "open",
  "rejected",
];

const isTicketStatus = (value: string): value is TicketStatus =>
  TICKET_STATUSES.some((status) => status === value);

backofficeRoutes.get("/tickets", async (c) => {
  const companyId = c.req.query("companyId");
  const status = c.req.query("status");
  if (status !== undefined && !isTicketStatus(status)) {
    return c.json({ error: "invalid status" }, 400);
  }
  const limit = parsePositiveInt(c.req.query("limit"), 50, 200);
  const items = await listTickets(c.var.db, { companyId, limit, status });
  const body: TicketsResponse = { items };
  return c.json(body);
});

backofficeRoutes.get("/actions", async (c) => {
  const status = c.req.query("status");
  const sort = c.req.query("sort");
  const companyId = c.req.query("companyId");

  const { db } = c.var;
  if (status === "pending") {
    const items = await listPendingActions(
      db,
      companyId !== undefined && companyId !== ""
        ? { companyId }
        : await getCoverage(db, c.get("session").userId),
    );
    const now = Date.now();
    const enriched = items.map((a) => ({
      actionType: a.actionType,
      agent: a.agent,
      ageSeconds: Math.floor((now - a.createdAt) / 1000),
      companyId: a.companyId,
      companyName: a.companyName,
      createdAt: a.createdAt,
      decidedAt: a.decidedAt,
      decidedByUserId: a.decidedByUserId,
      feedback: a.feedback,
      id: a.id,
      policy: a.policy,
      proposed: a.proposed,
      status: a.status,
      ticketId: a.ticketId,
    }));
    const sorted =
      sort === "age" ? enriched.toSorted((x, y) => y.ageSeconds - x.ageSeconds) : enriched;
    const pendingBody: ActionsResponse = { items: sorted };
    return c.json(pendingBody);
  }

  const items = await listActions(db, companyId);
  const body: ActionsResponse = { items };
  return c.json(body);
});

const decideBodySchema = z.object({
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  feedback: z.string().max(2000).optional(),
});

backofficeRoutes.post("/actions/:id/decide", async (c) => {
  const id = c.req.param("id");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const parsed = decideBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  }

  const { db } = c.var;
  const action = await getAction(db, id);
  if (!action) {
    return c.text("Not found", 404);
  }
  if (action.status !== "pending") {
    return c.json({ error: `action already ${action.status}` }, 409);
  }
  if (
    parsed.data.decision === "changes_requested" &&
    !(await canRequestChanges(db, action.ticketId))
  ) {
    return c.json({ error: "revision limit reached" }, 409);
  }

  const ticket = await loadTicket(db, action.ticketId);
  if (ticket === null || ticket.workflowId === null || ticket.workflowId === "") {
    return c.json({ error: "no workflow for this action" }, 500);
  }

  const instance = await c.env.WORKER_JOB.get(ticket.workflowId);
  await instance.sendEvent({
    payload: {
      decidedByUserId: c.get("session").userId,
      decision: parsed.data.decision,
      feedback: parsed.data.feedback,
    },
    type: decisionEventType(id),
  });

  return c.json({ ok: true });
});

backofficeRoutes.get("/activity", async (c) => {
  const companyId = c.req.query("companyId");
  const since = parseTimestamp(c.req.query("since"));
  const before = parseTimestamp(c.req.query("before"));
  const limit = parsePositiveInt(c.req.query("limit"), 100, 500);
  const rawCategory = c.req.query("category");
  const category = ACTIVITY_CATEGORIES.find((value) => value === rawCategory);
  const items = await listActivity(c.var.db, { before, category, companyId, limit, since });
  const body: ActivityResponse = { items };
  return c.json(body);
});

backofficeRoutes.get("/tickets/:id", async (c) => {
  const id = c.req.param("id");
  const { db } = c.var;
  const ticket = await loadTicket(db, id);
  if (!ticket) {
    return c.text("Not found", 404);
  }
  const actions = await listTicketActions(db, id);
  const body: TicketDetailResponse = { actions, ticket };
  return c.json(body);
});

backofficeRoutes.get("/actions/:id", async (c) => {
  const id = c.req.param("id");
  const { db } = c.var;
  const action = await getAction(db, id);
  if (!action) {
    return c.text("Not found", 404);
  }
  const [ticket, changesAllowed] = await Promise.all([
    loadTicket(db, action.ticketId),
    canRequestChanges(db, action.ticketId),
  ]);
  const ageSeconds = Math.floor((Date.now() - action.createdAt) / 1000);
  const body: ActionDetailResponse = {
    action,
    ageSeconds,
    canRequestChanges: changesAllowed,
    ticket,
  };
  return c.json(body);
});

backofficeRoutes.get("/companies", async (c) => {
  const { db } = c.var;
  const companies = await listCompaniesOverview(db);
  const rosters = await listTeamRosters(
    db,
    companies.map((company) => company.id),
  );
  const withRosters = companies.map((company): CompanyRoster => ({
    briefPercent: company.briefPercent,
    id: company.id,
    members: rosters.get(company.id) ?? [],
    name: company.name,
    status: company.status,
  }));
  return c.json({ companies: withRosters });
});

const SLUG_PATTERN = /^[a-z0-9\-]+$/v;

const companyBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(SLUG_PATTERN, "slug must be lowercase alphanumeric or dashes"),
});

backofficeRoutes.post("/companies", async (c) => {
  const parsed = companyBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  }
  try {
    const company = await createOrganization(c.var.db, {
      ...parsed.data,
      ownerUserId: c.get("session").userId,
    });
    return c.json({ company }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return c.json({ error: "slug already in use" }, 409);
    }
    throw error;
  }
});

backofficeRoutes.get("/assignments/me", async (c) => {
  const { db } = c.var;
  const [assigned, options] = await Promise.all([
    getCoverage(db, c.get("session").userId),
    getCoverageOptions(db),
  ]);
  const body: CoverageResponse = { assigned, options };
  return c.json(body);
});

const coverageBodySchema = z.object({
  companies: z.array(z.string().min(1)).max(1000),
  disciplines: z.array(z.string().min(1)).max(100),
});

backofficeRoutes.put("/assignments/me", async (c) => {
  const parsed = coverageBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body" }, 400);
  }
  await setCoverage(c.var.db, c.get("session").userId, parsed.data);
  return c.json({ assigned: parsed.data });
});

backofficeRoutes.get("/teams/:companyId/members", async (c) => {
  const companyId = c.req.param("companyId");
  const members = await getTeamRoster(c.var.db, companyId);
  return c.json({ members });
});

backofficeRoutes.get("/teams/:companyId/members/:id", async (c) => {
  const member = await getMemberDetail(c.var.db, c.req.param("companyId"), c.req.param("id"));
  if (!member) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json({ member });
});

backofficeRoutes.patch("/teams/:companyId/members/:id", async (c) => {
  const companyId = c.req.param("companyId");
  const id = c.req.param("id");
  const parsed = backofficeTeamMemberPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body" }, 400);
  }
  const { db } = c.var;
  try {
    await (parsed.data.status === undefined
      ? updateMember(c.env, db, {
          agentInstanceId: id,
          companyId,
          displayName: parsed.data.displayName,
          editedBy: "operator",
          operatorId: c.get("session").userId,
          promptOverride: parsed.data.promptOverride,
        })
      : setMemberStatus(c.env, db, {
          actorId: c.get("session").userId,
          agentInstanceId: id,
          companyId,
          status: parsed.data.status,
        }));
    const member = await getMemberDetail(db, companyId, id);
    if (!member) {
      return c.json({ error: "not found" }, 404);
    }
    return c.json({ member });
  } catch (error) {
    if (error instanceof TeamError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

const skillIdsSchema = z.array(z.string().min(1)).refine((ids) => ids.every(isKnownSkill), {
  message: "unknown skill id",
});

const templateBodySchema = z.object({
  defaultActionType: z.string().trim().min(1).max(80).default("worker_deliverable"),
  defaultPolicies: z.record(z.string(), z.string()).default({}),
  description: z.string().trim().min(1).max(2000),
  displayName: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(160),
  skillIds: skillIdsSchema,
  systemPrompt: z.string().trim().min(1).max(20_000),
  workerKind: z.string().trim().min(1).max(80),
});

const templateStatusSchema = z.object({
  status: z.enum(["active", "retired"]),
});

backofficeRoutes.get("/skills", (c) => {
  const body: SkillCatalogResponse = { items: listSkillCatalog() };
  return c.json(body);
});

backofficeRoutes.get("/templates", async (c) => {
  const items = await listAllTemplates(c.var.db);
  const body: TemplatesResponse = { items };
  return c.json(body);
});

backofficeRoutes.get("/templates/:id", async (c) => {
  const template = await getTemplate(c.var.db, c.req.param("id"));
  if (!template) {
    return c.json({ error: "not found" }, 404);
  }
  const body: TemplateResponse = { template };
  return c.json(body);
});

backofficeRoutes.post("/templates", async (c) => {
  const parsed = templateBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  }
  const input: TemplateInput = parsed.data;
  const template = await createTemplate(c.var.db, input);
  const body: TemplateResponse = { template };
  return c.json(body, 201);
});

backofficeRoutes.patch("/templates/:id", async (c) => {
  const parsed = templateBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  }
  const input: TemplateInput = parsed.data;
  const template = await updateTemplate(c.var.db, c.req.param("id"), input);
  if (!template) {
    return c.json({ error: "not found" }, 404);
  }
  const body: TemplateResponse = { template };
  return c.json(body);
});

backofficeRoutes.patch("/templates/:id/status", async (c) => {
  const parsed = templateStatusSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  }
  const template = await setTemplateStatus(c.var.db, c.req.param("id"), parsed.data.status);
  if (!template) {
    return c.json({ error: "not found" }, 404);
  }
  const body: TemplateResponse = { template };
  return c.json(body);
});

export { backofficeRoutes };
