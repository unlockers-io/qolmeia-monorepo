import { sendCustomerInvitation } from "@repo/auth/server";
import { ACTIVITY_CATEGORIES } from "@repo/worker-api/contracts";
import { BACKOFFICE } from "@repo/worker-api/endpoints";
import { Hono } from "hono";

import { getActionDetail, listPendingActions, listTicketActions } from "#/action/action";
import { submitDecision } from "#/action/decision";
import { listActivity } from "#/activity/log";
import { listCompaniesOverview } from "#/company/company";
import { inviteCustomer } from "#/company/invitation";
import { createOrganization } from "#/company/organization";
import { requireOperator, type IdentityEnv } from "#/identity/gates";
import { createWorkerAuth } from "#/lib/auth";
import { answer } from "#/lib/endpoint";
import { parsePositiveInt, parseTimestamp } from "#/lib/pagination";
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

backofficeRoutes.use("/api/backoffice/*", requireOperator);

answer(backofficeRoutes, BACKOFFICE.tickets, async (c, { query }) => ({
  items: await listTickets(c.var.db, parsePositiveInt(query.limit, 50, 200)),
}));

answer(backofficeRoutes, BACKOFFICE.ticket, async (c, { params }) => {
  const { db } = c.var;
  const ticket = await loadTicket(db, params.id);

  if (!ticket) {
    return c.json({ error: "not found" }, 404);
  }

  return { actions: await listTicketActions(db, params.id), ticket };
});

answer(backofficeRoutes, BACKOFFICE.pendingActions, async (c) => {
  const { db } = c.var;

  return { items: await listPendingActions(db, await getCoverage(db, c.var.session.userId)) };
});

answer(backofficeRoutes, BACKOFFICE.action, async (c, { params }) => {
  const detail = await getActionDetail(c.var.db, params.id);

  return detail ?? c.json({ error: "not found" }, 404);
});

answer(backofficeRoutes, BACKOFFICE.decide, async (c, { body, params }) => {
  await submitDecision(c.env, c.var.db, params.id, {
    ...body,
    decidedByUserId: c.var.session.userId,
  });

  return { ok: true };
});

answer(backofficeRoutes, BACKOFFICE.activity, async (c, { query }) => ({
  items: await listActivity(c.var.db, {
    before: parseTimestamp(query.before),
    category: ACTIVITY_CATEGORIES.find((value) => value === query.category),
    limit: parsePositiveInt(query.limit, 100, 500),
  }),
}));

answer(backofficeRoutes, BACKOFFICE.companies, async (c) => {
  const { db } = c.var;
  const companies = await listCompaniesOverview(db);

  const rosters = await listTeamRosters(
    db,
    companies.map((company) => company.id),
  );

  return {
    companies: companies.map((company) =>
      Object.assign(company, { members: rosters.get(company.id) ?? [] }),
    ),
  };
});

answer(backofficeRoutes, BACKOFFICE.createCompany, async (c, { body }) => ({
  company: await createOrganization(c.var.db, body),
}));

answer(backofficeRoutes, BACKOFFICE.inviteCustomer, async (c, { body, params }) => {
  const { companyName, invitation } = await inviteCustomer(
    createWorkerAuth(c.env, c.var.db),
    c.var.db,
    { companyId: params.companyId, email: body.email, inviterId: c.var.session.userId },
  );

  const sent = await sendCustomerInvitation({
    acceptUrl: `${c.env.WEB_APP_URL}/convite/${invitation.id}`,
    companyName,
    email: invitation.email,
    resendApiKey: c.env.RESEND_API_KEY,
  });

  return sent ? { invitation } : c.json({ error: "invitation email failed" }, 502);
});

answer(backofficeRoutes, BACKOFFICE.coverage, async (c) => {
  const { db } = c.var;

  const [assigned, options] = await Promise.all([
    getCoverage(db, c.var.session.userId),
    getCoverageOptions(db),
  ]);

  return { assigned, options };
});

answer(backofficeRoutes, BACKOFFICE.saveCoverage, async (c, { body }) => {
  await setCoverage(c.var.db, c.var.session.userId, body);

  return { assigned: body };
});

answer(backofficeRoutes, BACKOFFICE.member, async (c, { params }) => ({
  member: await getMemberDetail(c.var.db, params.companyId, params.id),
}));

answer(backofficeRoutes, BACKOFFICE.patchMember, async (c, { body, params }) => {
  const target = { actor: c.var.session, agentInstanceId: params.id, companyId: params.companyId };

  await ("status" in body
    ? setMemberStatus(c.env, c.var.db, { ...target, status: body.status })
    : updateMember(c.env, c.var.db, { ...target, ...body }));

  return { member: await getMemberDetail(c.var.db, target.companyId, target.agentInstanceId) };
});

answer(backofficeRoutes, BACKOFFICE.skills, () => ({ items: listSkillCatalog() }));

answer(backofficeRoutes, BACKOFFICE.templates, async (c) => ({
  items: await listAllTemplates(c.var.db),
}));

answer(backofficeRoutes, BACKOFFICE.template, async (c, { params }) => {
  const template = await getTemplate(c.var.db, params.id);

  return template ? { template } : c.json({ error: "not found" }, 404);
});

answer(backofficeRoutes, BACKOFFICE.createTemplate, async (c, { body }) => ({
  template: await createTemplate(c.var.db, body),
}));

answer(backofficeRoutes, BACKOFFICE.updateTemplate, async (c, { body, params }) => {
  const template = await updateTemplate(c.var.db, params.id, body);

  return template ? { template } : c.json({ error: "not found" }, 404);
});

answer(backofficeRoutes, BACKOFFICE.setTemplateStatus, async (c, { body, params }) => {
  const template = await setTemplateStatus(c.var.db, params.id, body.status);

  return template ? { template } : c.json({ error: "not found" }, 404);
});

export { backofficeRoutes };
