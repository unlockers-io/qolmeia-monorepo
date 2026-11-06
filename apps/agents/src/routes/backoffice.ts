import { sendCustomerInvitation } from "@repo/auth/server";
import {
  ACTIVITY_CATEGORIES,
  companyInputSchema,
  coverageInputSchema,
  decisionInputSchema,
  invitationInputSchema,
  operatorMemberPatchSchema,
  templateInputSchema,
  templateStatusInputSchema,
  type ActionDetailResponse,
  type ActivityResponse,
  type CompaniesResponse,
  type CoverageResponse,
  type CustomerInvitationResponse,
  type MemberDetailResponse,
  type PendingActionsResponse,
  type SkillCatalogResponse,
  type TemplateResponse,
  type TemplatesResponse,
  type TicketDetailResponse,
  type TicketsResponse,
} from "@repo/worker-api/contracts";
import { Hono } from "hono";

import { getActionDetail, listPendingActions, listTicketActions } from "#/action/action";
import { submitDecision } from "#/action/decision";
import { listActivity } from "#/activity/log";
import { listCompaniesOverview } from "#/company/company";
import { inviteCustomer } from "#/company/invitation";
import { createOrganization } from "#/company/organization";
import { requireOperator, type IdentityEnv } from "#/identity/gates";
import { createWorkerAuth } from "#/lib/auth";
import { parsePositiveInt, parseTimestamp } from "#/lib/pagination";
import { jsonBody } from "#/lib/validate";
import { getCoverage, getCoverageOptions, setCoverage } from "#/operator/assignment";
import { listSkillCatalog } from "#/skills/registry";
import { setMemberStatus, updateMember } from "#/team/members";
import { getMemberDetail, listTeamRosters } from "#/team/roster";
import {
  createTemplate,
  getTemplate,
  listAllTemplates,
  setTemplateStatus,
  updateTemplate,
} from "#/template/template";
import { listTickets, loadTicket } from "#/ticket/ticket";

const backofficeRoutes = new Hono<IdentityEnv>();

backofficeRoutes.use("*", requireOperator);

backofficeRoutes.get("/tickets", async (c) => {
  const body: TicketsResponse = {
    items: await listTickets(c.var.db, parsePositiveInt(c.req.query("limit"), 50, 200)),
  };

  return c.json(body);
});

backofficeRoutes.get("/tickets/:id", async (c) => {
  const id = c.req.param("id");
  const { db } = c.var;
  const ticket = await loadTicket(db, id);

  if (!ticket) {
    return c.json({ error: "not found" }, 404);
  }

  const body: TicketDetailResponse = { actions: await listTicketActions(db, id), ticket };

  return c.json(body);
});

backofficeRoutes.get("/actions", async (c) => {
  const { db } = c.var;

  const body: PendingActionsResponse = {
    items: await listPendingActions(db, await getCoverage(db, c.var.session.userId)),
  };

  return c.json(body);
});

backofficeRoutes.get("/actions/:id", async (c) => {
  const body: ActionDetailResponse | null = await getActionDetail(c.var.db, c.req.param("id"));

  if (!body) {
    return c.json({ error: "not found" }, 404);
  }

  return c.json(body);
});

backofficeRoutes.post("/actions/:id/decide", jsonBody(decisionInputSchema), async (c) => {
  await submitDecision(c.env, c.var.db, c.req.param("id"), {
    ...c.req.valid("json"),
    decidedByUserId: c.var.session.userId,
  });

  return c.json({ ok: true });
});

backofficeRoutes.get("/activity", async (c) => {
  const rawCategory = c.req.query("category");

  const body: ActivityResponse = {
    items: await listActivity(c.var.db, {
      before: parseTimestamp(c.req.query("before")),
      category: ACTIVITY_CATEGORIES.find((value) => value === rawCategory),
      limit: parsePositiveInt(c.req.query("limit"), 100, 500),
    }),
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

  const body: CompaniesResponse = {
    companies: companies.map((company) =>
      Object.assign(company, { members: rosters.get(company.id) ?? [] }),
    ),
  };

  return c.json(body);
});

backofficeRoutes.post("/companies", jsonBody(companyInputSchema), async (c) => {
  const company = await createOrganization(c.var.db, c.req.valid("json"));

  return c.json({ company }, 201);
});

backofficeRoutes.post(
  "/companies/:companyId/invitations",
  jsonBody(invitationInputSchema),
  async (c) => {
    const { companyName, invitation } = await inviteCustomer(
      createWorkerAuth(c.env, c.var.db),
      c.var.db,
      {
        companyId: c.req.param("companyId"),
        email: c.req.valid("json").email,
        inviterId: c.var.session.userId,
      },
    );

    const sent = await sendCustomerInvitation({
      acceptUrl: `${c.env.WEB_APP_URL}/convite/${invitation.id}`,
      companyName,
      email: invitation.email,
      resendApiKey: c.env.RESEND_API_KEY,
    });

    if (!sent) {
      return c.json({ error: "invitation email failed" }, 502);
    }

    const body: CustomerInvitationResponse = { invitation };

    return c.json(body, 201);
  },
);

backofficeRoutes.get("/assignments/me", async (c) => {
  const { db } = c.var;

  const [assigned, options] = await Promise.all([
    getCoverage(db, c.var.session.userId),
    getCoverageOptions(db),
  ]);

  const body: CoverageResponse = { assigned, options };

  return c.json(body);
});

backofficeRoutes.put("/assignments/me", jsonBody(coverageInputSchema), async (c) => {
  const assigned = c.req.valid("json");
  await setCoverage(c.var.db, c.var.session.userId, assigned);

  const body: Pick<CoverageResponse, "assigned"> = { assigned };

  return c.json(body);
});

backofficeRoutes.get("/teams/:companyId/members/:id", async (c) => {
  const body: MemberDetailResponse = {
    member: await getMemberDetail(c.var.db, c.req.param("companyId"), c.req.param("id")),
  };

  return c.json(body);
});

backofficeRoutes.patch(
  "/teams/:companyId/members/:id",
  jsonBody(operatorMemberPatchSchema),
  async (c) => {
    const patch = c.req.valid("json");

    const target = {
      actor: c.var.session,
      agentInstanceId: c.req.param("id"),
      companyId: c.req.param("companyId"),
    };

    await ("status" in patch
      ? setMemberStatus(c.env, c.var.db, { ...target, status: patch.status })
      : updateMember(c.env, c.var.db, { ...target, ...patch }));

    const body: MemberDetailResponse = {
      member: await getMemberDetail(c.var.db, target.companyId, target.agentInstanceId),
    };

    return c.json(body);
  },
);

backofficeRoutes.get("/skills", (c) => {
  const body: SkillCatalogResponse = { items: listSkillCatalog() };

  return c.json(body);
});

backofficeRoutes.get("/templates", async (c) => {
  const body: TemplatesResponse = { items: await listAllTemplates(c.var.db) };

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

backofficeRoutes.post("/templates", jsonBody(templateInputSchema), async (c) => {
  const body: TemplateResponse = {
    template: await createTemplate(c.var.db, c.req.valid("json")),
  };

  return c.json(body, 201);
});

backofficeRoutes.patch("/templates/:id", jsonBody(templateInputSchema), async (c) => {
  const template = await updateTemplate(c.var.db, c.req.param("id"), c.req.valid("json"));

  if (!template) {
    return c.json({ error: "not found" }, 404);
  }

  const body: TemplateResponse = { template };

  return c.json(body);
});

backofficeRoutes.patch("/templates/:id/status", jsonBody(templateStatusInputSchema), async (c) => {
  const template = await setTemplateStatus(c.var.db, c.req.param("id"), c.req.valid("json").status);

  if (!template) {
    return c.json({ error: "not found" }, 404);
  }

  const body: TemplateResponse = { template };

  return c.json(body);
});

export { backofficeRoutes };
