import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { proposeAction } from "#/action/approval";
import { recordActivity } from "#/activity/log";

const COMPANY_ID = "co_bo_test";
const OTHER_COMPANY_ID = "co_bo_other";
const STAFF_ID = "staff-1";
const originalFetch = globalThis.fetch;

const meStaff = {
  currentOrg: { id: COMPANY_ID, role: "STAFF" },
  user: { id: STAFF_ID },
};
const meCustomer = {
  currentOrg: { id: COMPANY_ID, role: "CUSTOMER" },
  user: { id: "cust-1" },
};

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
    proposeAction(client, {
      actionType: "worker_deliverable",
      companyId,
      feedback: null,
      policy: "require_approval",
      proposed: { summary },
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
  exports.default.fetch("https://agents.test/api/backoffice/companies?cf_session=tok", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

beforeEach(async () => {
  await seedTenant(COMPANY_ID, "BO Test", "test");
  await seedTenant(OTHER_COMPANY_ID, "BO Other", "other");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("backoffice auth gate", () => {
  it("rejects unauthenticated with 401", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?cf_session=tok",
    );
    expect(res.status).toBe(401);
  });

  it("rejects CUSTOMER with 403", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?cf_session=tok",
    );
    expect(res.status).toBe(403);
  });

  it("admits STAFF with 200", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?cf_session=tok",
    );
    expect(res.status).toBe(200);
  });
});

describe("backoffice listing endpoints", () => {
  it("lists tickets across all tenants (camelCase shape + company label)", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?cf_session=tok",
    );
    const body = await res.json<{
      items: Array<{
        agentInstanceId: string;
        companyId: string;
        companyName: string;
        createdAt: number;
        id: string;
        origin: string;
        title: string;
      }>;
    }>();
    const ticket = body.items.find((t) => t.id === "tkt-bo-test");
    expect(ticket).toBeTruthy();
    expect(ticket?.agentInstanceId).toBe("agent-bo-test");
    expect(ticket?.companyId).toBe(COMPANY_ID);
    expect(ticket?.companyName).toBe("BO Test");
    expect(ticket?.origin).toBe("delegation");
    expect(typeof ticket?.createdAt).toBe("number");
    expect(ticket).not.toHaveProperty("agent_instance_id");
    expect(ticket).not.toHaveProperty("created_at");
    expect(body.items.find((t) => t.id === "tkt-bo-other")).toBeTruthy();
  });

  it("lists pending actions sorted by age (oldest first)", async () => {
    await propose(COMPANY_ID, "tkt-bo-test", "x");
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/actions?status=pending&sort=age&cf_session=tok",
    );
    const body = await res.json<{
      items: Array<{ actionType: string; ageSeconds: number }>;
    }>();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty("ageSeconds");
    expect(body.items[0]?.actionType).toBe("worker_deliverable");
  });

  it("lists ALL actions (no status filter) in camelCase", async () => {
    await propose(COMPANY_ID, "tkt-bo-test", "y");
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/actions?cf_session=tok",
    );
    const body = await res.json<{
      items: Array<{
        actionType: string;
        companyId: string;
        createdAt: number;
        id: string;
        ticketId: string;
      }>;
    }>();
    expect(body.items.length).toBeGreaterThan(0);
    const item = body.items[0];
    expect(item?.actionType).toBeTruthy();
    expect(item?.companyId).toBe(COMPANY_ID);
    expect(typeof item?.createdAt).toBe("number");
    expect(item).not.toHaveProperty("action_type");
    expect(item).not.toHaveProperty("company_id");
    expect(item).not.toHaveProperty("ticket_id");
  });
});

describe("backoffice list routes span tenants and honor the ?companyId= filter", () => {
  it("GET /tickets?companyId= narrows to that company; unfiltered spans all", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const filtered = await exports.default.fetch(
      `https://agents.test/api/backoffice/tickets?companyId=${OTHER_COMPANY_ID}&cf_session=tok`,
    );
    expect(filtered.status).toBe(200);
    const filteredBody = await filtered.json<{
      items: Array<{ companyId: string; id: string }>;
    }>();
    expect(filteredBody.items.find((t) => t.id === "tkt-bo-other")).toBeTruthy();
    expect(filteredBody.items.every((t) => t.companyId === OTHER_COMPANY_ID)).toBe(true);

    const all = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?cf_session=tok",
    );
    const allBody = await all.json<{ items: Array<{ id: string }> }>();
    expect(allBody.items.find((t) => t.id === "tkt-bo-test")).toBeTruthy();
    expect(allBody.items.find((t) => t.id === "tkt-bo-other")).toBeTruthy();
  });

  it("GET /actions?companyId= narrows to that company; unfiltered spans all", async () => {
    await propose(COMPANY_ID, "tkt-bo-test", "mine");
    await propose(OTHER_COMPANY_ID, "tkt-bo-other", "theirs");
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const filtered = await exports.default.fetch(
      `https://agents.test/api/backoffice/actions?companyId=${OTHER_COMPANY_ID}&cf_session=tok`,
    );
    expect(filtered.status).toBe(200);
    const filteredBody = await filtered.json<{ items: Array<{ companyId: string }> }>();
    expect(filteredBody.items.length).toBeGreaterThan(0);
    expect(filteredBody.items.every((a) => a.companyId === OTHER_COMPANY_ID)).toBe(true);

    const all = await exports.default.fetch(
      "https://agents.test/api/backoffice/actions?cf_session=tok",
    );
    const allBody = await all.json<{ items: Array<{ companyId: string }> }>();
    expect(allBody.items.some((a) => a.companyId === COMPANY_ID)).toBe(true);
    expect(allBody.items.some((a) => a.companyId === OTHER_COMPANY_ID)).toBe(true);
  });

  it("GET /activity?companyId= narrows to that company; unfiltered spans all", async () => {
    await logExecuted(COMPANY_ID, "tkt-bo-test", "mine");
    await logExecuted(OTHER_COMPANY_ID, "tkt-bo-other", "theirs");
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const filtered = await exports.default.fetch(
      `https://agents.test/api/backoffice/activity?companyId=${OTHER_COMPANY_ID}&cf_session=tok`,
    );
    expect(filtered.status).toBe(200);
    const filteredBody = await filtered.json<{ items: Array<{ companyId: string }> }>();
    expect(filteredBody.items.length).toBeGreaterThan(0);
    expect(filteredBody.items.every((a) => a.companyId === OTHER_COMPANY_ID)).toBe(true);

    const all = await exports.default.fetch(
      "https://agents.test/api/backoffice/activity?cf_session=tok",
    );
    const allBody = await all.json<{ items: Array<{ companyId: string }> }>();
    expect(allBody.items.some((a) => a.companyId === COMPANY_ID)).toBe(true);
    expect(allBody.items.some((a) => a.companyId === OTHER_COMPANY_ID)).toBe(true);
  });
});

describe("backoffice list query-param hardening", () => {
  it("GET /tickets rejects an unknown status", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));

    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?status=unknown&cf_session=tok",
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid status" });
  });

  it("GET /tickets ignores a non-numeric limit and clamps an oversized one", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));

    const nonNumeric = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?limit=abc&cf_session=tok",
    );
    expect(nonNumeric.status).toBe(200);
    const nonNumericBody = await nonNumeric.json<{ items: Array<{ id: string }> }>();
    expect(nonNumericBody.items.find((t) => t.id === "tkt-bo-test")).toBeTruthy();

    const oversized = await exports.default.fetch(
      "https://agents.test/api/backoffice/tickets?limit=999999&cf_session=tok",
    );
    expect(oversized.status).toBe(200);
    const oversizedBody = await oversized.json<{ items: Array<{ id: string }> }>();
    expect(oversizedBody.items.find((t) => t.id === "tkt-bo-test")).toBeTruthy();
  });

  it("GET /activity ignores non-numeric limit, since, and before", async () => {
    await logExecuted(COMPANY_ID, "tkt-bo-test", "hardening");
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));

    const badLimit = await exports.default.fetch(
      "https://agents.test/api/backoffice/activity?limit=abc&cf_session=tok",
    );
    expect(badLimit.status).toBe(200);
    const badLimitBody = await badLimit.json<{ items: Array<{ summary: string }> }>();
    expect(badLimitBody.items.some((a) => a.summary === "hardening")).toBe(true);

    const badWindow = await exports.default.fetch(
      "https://agents.test/api/backoffice/activity?since=abc&before=xyz&cf_session=tok",
    );
    expect(badWindow.status).toBe(200);
    const badWindowBody = await badWindow.json<{ items: Array<{ summary: string }> }>();
    expect(badWindowBody.items.some((a) => a.summary === "hardening")).toBe(true);
  });
});

describe("operator override decide", () => {
  it("returns 404 for an unknown action id", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/actions/does-not-exist/decide?cf_session=tok",
      {
        body: JSON.stringify({ decision: "approved" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid body", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/actions/whatever/decide?cf_session=tok",
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

  it("creates the organization, owner membership, company, agents, and active entitlements", async () => {
    await db((client) =>
      client.agentTemplate.update({
        data: { status: "retired" },
        where: { id: "tpl-seo-researcher" },
      }),
    );
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));

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
    expect(membership).toMatchObject({ role: "OWNER", userId: STAFF_ID });
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
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
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
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));

    const res = await createCompany({ name: "Padaria", slug: "Padaria Nova!" });

    expect(res.status).toBe(400);
    await expect(db((client) => client.organization.count())).resolves.toBe(0);
  });

  it("rejects a CUSTOMER session with 403", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));

    const res = await createCompany({ name: "Padaria", slug: "padaria" });

    expect(res.status).toBe(403);
    await expect(db((client) => client.organization.count())).resolves.toBe(0);
  });
});
