import type { PendingActionsResponse, TicketsResponse } from "@repo/worker-api/contracts";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";
import { proposeAction } from "#/action/approval";
import { recordActivity } from "#/activity/log";

const COMPANY_ID = "co_bo_test";
const OTHER_COMPANY_ID = "co_bo_other";
const STAFF_ID = "staff-1";

const meStaff: Persona = { orgId: COMPANY_ID, role: "STAFF", userId: STAFF_ID };
const meCustomer: Persona = { orgId: COMPANY_ID, role: "CUSTOMER", userId: "cust-1" };

const seedTenant = async (companyId: string, name: string, suffix: string) => {
  const agentId = `agent-bo-${suffix}`;
  await seedCompany({ id: companyId, name });
  await seedTeam(companyId, [{ displayName: "d", id: agentId }]);
  await seedTicket({
    agentInstanceId: agentId,
    brief: "b",
    companyId,
    id: `tkt-bo-${suffix}`,
    status: "awaiting_approval",
  });
};

const propose = (companyId: string, ticketId: string, summary: string) =>
  db((client) =>
    proposeAction(env, client, {
      actionType: "worker_deliverable",
      companyId,
      feedback: null,
      policy: "require_approval",
      proposed: { assetIds: [], summary },
      round: 0,
      summary,
      ticketId,
    }),
  );

const logExecuted = (companyId: string, refId: string, summary: string) =>
  db((client) =>
    recordActivity(client, {
      companyId,
      refId,
      refType: "action",
      summary,
      type: "ACTION_EXECUTED",
    }),
  );

const createCompany = (body: { name: string; slug: string }) =>
  fetchWithCookie(cookie, "https://agents.test/api/backoffice/companies", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

let cookie = "";

beforeEach(async () => {
  cookie = "";
  await seedTenant(COMPANY_ID, "BO Test", "test");
  await seedTenant(OTHER_COMPANY_ID, "BO Other", "other");
});

describe("backoffice auth gate", () => {
  it("rejects unauthenticated with 401", async () => {
    cookie = "";
    const res = await fetchWithCookie(cookie, "https://agents.test/api/backoffice/tickets");
    expect(res.status).toBe(401);
  });

  it("rejects CUSTOMER with 403", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/backoffice/tickets");
    expect(res.status).toBe(403);
  });

  it("admits STAFF with 200", async () => {
    cookie = await signInAs(meStaff);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/backoffice/tickets");
    expect(res.status).toBe(200);
  });
});

describe("backoffice listing endpoints", () => {
  it("lists tickets across all tenants with their agent and company", async () => {
    cookie = await signInAs(meStaff);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/backoffice/tickets");
    const body = await res.json<TicketsResponse>();

    const ticket = body.items.find((t) => t.id === "tkt-bo-test");
    expect(ticket).toMatchObject({
      agent: { name: "d", role: "worker", workerKind: "designer" },
      companyId: COMPANY_ID,
      companyName: "BO Test",
      title: "b",
    });
    expect(typeof ticket?.createdAt).toBe("number");
    expect(body.items.find((t) => t.id === "tkt-bo-other")).toBeTruthy();
  });

  it("lists the pending queue across tenants, oldest first, with each Action's age", async () => {
    await propose(COMPANY_ID, "tkt-bo-test", "mine");
    await propose(OTHER_COMPANY_ID, "tkt-bo-other", "theirs");
    cookie = await signInAs(meStaff);

    const res = await fetchWithCookie(cookie, "https://agents.test/api/backoffice/actions");
    const body = await res.json<PendingActionsResponse>();

    expect(body.items.map(({ companyId }) => companyId)).toEqual([COMPANY_ID, OTHER_COMPANY_ID]);
    expect(body.items[0]).toMatchObject({
      actionType: "worker_deliverable",
      ageSeconds: expect.any(Number),
      proposed: { assetIds: [], summary: "mine" },
      status: "pending",
    });
  });
});

describe("backoffice list query-param hardening", () => {
  it("GET /tickets ignores a non-numeric limit and clamps an oversized one", async () => {
    cookie = await signInAs(meStaff);

    const nonNumeric = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/tickets?limit=abc",
    );

    expect(nonNumeric.status).toBe(200);
    const nonNumericBody = await nonNumeric.json<{ items: Array<{ id: string }> }>();
    expect(nonNumericBody.items.find((t) => t.id === "tkt-bo-test")).toBeTruthy();

    const oversized = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/tickets?limit=999999",
    );

    expect(oversized.status).toBe(200);
    const oversizedBody = await oversized.json<{ items: Array<{ id: string }> }>();
    expect(oversizedBody.items.find((t) => t.id === "tkt-bo-test")).toBeTruthy();
  });

  it("GET /activity ignores a non-numeric limit and before", async () => {
    await logExecuted(COMPANY_ID, "tkt-bo-test", "hardening");
    cookie = await signInAs(meStaff);

    const badLimit = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/activity?limit=abc",
    );

    expect(badLimit.status).toBe(200);
    const badLimitBody = await badLimit.json<{ items: Array<{ summary: string }> }>();
    expect(badLimitBody.items.some((a) => a.summary === "hardening")).toBe(true);

    const badWindow = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/activity?before=xyz",
    );

    expect(badWindow.status).toBe(200);
    const badWindowBody = await badWindow.json<{ items: Array<{ summary: string }> }>();
    expect(badWindowBody.items.some((a) => a.summary === "hardening")).toBe(true);
  });
});

it.each(["tickets", "actions"])("answers an unknown %s id with a JSON 404", async (resource) => {
  cookie = await signInAs(meStaff);

  const res = await fetchWithCookie(
    cookie,
    `https://agents.test/api/backoffice/${resource}/does-not-exist`,
  );

  expect(res.status).toBe(404);
  await expect(res.json()).resolves.toEqual({ error: "not found" });
});

describe("operator override decide", () => {
  it("returns 404 for an unknown action id", async () => {
    cookie = await signInAs(meStaff);

    const res = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/actions/does-not-exist/decide",
      {
        body: JSON.stringify({ decision: "approved" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid body", async () => {
    cookie = await signInAs(meStaff);

    const res = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/actions/whatever/decide",
      {
        body: JSON.stringify({ decision: "maybe" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    expect(res.status).toBe(400);
  });
});

describe("POST /api/backoffice/companies", () => {
  beforeEach(async () => {
    await db((client) =>
      client.user.create({ data: { email: "staff-1@qolmeia.test", id: STAFF_ID, name: "Staff" } }),
    );
  });

  it("creates the organization, company, agents, and active entitlements without an operator membership", async () => {
    await db((client) =>
      client.agentTemplate.update({
        data: { status: "retired" },
        where: { id: "tpl-seo-researcher" },
      }),
    );
    cookie = await signInAs(meStaff);

    const res = await createCompany({ name: "Padaria Nova", slug: "padaria-nova" });

    expect(res.status).toBe(201);
    const { company } = await res.json<{ company: { id: string; name: string; slug: string } }>();
    expect(company).toEqual({ id: expect.any(String), name: "Padaria Nova", slug: "padaria-nova" });

    const [organization, membership, stored, agents, entitlements] = await db((client) =>
      Promise.all([
        client.organization.findUnique({ where: { id: company.id } }),
        client.orgMembership.findFirst({ where: { orgId: company.id } }),
        client.company.findUnique({ where: { id: company.id } }),
        client.agentInstance.findMany({
          select: { id: true, role: true },
          where: { companyId: company.id },
        }),
        client.companyTemplateEntitlement.findMany({
          orderBy: { templateId: "asc" },
          select: { templateId: true },
          where: { companyId: company.id },
        }),
      ]),
    );

    expect(organization).toMatchObject({ name: "Padaria Nova", slug: "padaria-nova" });
    expect(membership).toBeNull();
    expect(stored).toMatchObject({ name: "Padaria Nova", slug: "padaria-nova" });
    expect(agents).toEqual(
      expect.arrayContaining([
        { id: `corr-${company.id}`, role: "correspondent" },
        { id: `planner-${company.id}`, role: "planner" },
      ]),
    );
    expect(agents).toHaveLength(2);
    expect(entitlements.map(({ templateId }) => templateId)).toEqual([
      "tpl-designer",
      "tpl-marketing-strategist",
      "tpl-redator",
    ]);
  });

  it("returns 409 when the slug is already in use", async () => {
    cookie = await signInAs(meStaff);
    const first = await createCompany({ name: "Primeira", slug: "repetida" });
    expect(first.status).toBe(201);

    const duplicate = await createCompany({ name: "Segunda", slug: "repetida" });

    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({ error: "slug already in use" });
    await expect(
      db((client) => client.company.count({ where: { name: "Segunda" } })),
    ).resolves.toBe(0);
  });

  it("returns 400 for an invalid slug", async () => {
    cookie = await signInAs(meStaff);

    const res = await createCompany({ name: "Padaria", slug: "Padaria Nova!" });

    expect(res.status).toBe(400);
    await expect(
      db((client) => client.organization.count({ where: { name: "Padaria" } })),
    ).resolves.toBe(0);
  });

  it("rejects a CUSTOMER session with 403", async () => {
    cookie = await signInAs(meCustomer);

    const res = await createCompany({ name: "Padaria", slug: "padaria" });

    expect(res.status).toBe(403);
    await expect(
      db((client) => client.organization.count({ where: { name: "Padaria" } })),
    ).resolves.toBe(0);
  });
});
