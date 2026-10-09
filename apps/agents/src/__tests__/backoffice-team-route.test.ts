import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedCompany, seedTeam } from "#/__tests__/fixtures";

const COMPANY_ID = "co_bot_test";
const CORR_ID = `corr-${COMPANY_ID}`;
const WORKER_ID = "ai_bot_d";
const originalFetch = globalThis.fetch;

const meStaff = {
  currentOrg: { id: COMPANY_ID, role: "STAFF" },
  user: { id: "staff-1" },
};
const meCustomer = {
  currentOrg: { id: COMPANY_ID, role: "CUSTOMER" },
  user: { id: "user-1" },
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, name: "BT" });
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
  await db((client) =>
    client.agentTemplate.update({
      data: { systemPrompt: "TPL_PROMPT" },
      where: { id: "tpl-designer" },
    }),
  );
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("/api/backoffice/teams/:companyId/members", () => {
  it("lists members for STAFF", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members?cf_session=tok`,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ members: Array<{ id: string }> }>();
    expect(body.members.some((m) => m.id === WORKER_ID)).toBe(true);
  });

  it("403 for CUSTOMER", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members?cf_session=tok`,
    );
    expect(res.status).toBe(403);
  });

  it("GET member detail returns templateSystemPrompt and promptOverride", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members/${WORKER_ID}?cf_session=tok`,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      member: { promptOverride: string | null; templateSystemPrompt: string };
    }>();
    expect(body.member.templateSystemPrompt).toBe("TPL_PROMPT");
    expect(body.member.promptOverride).toBeNull();
  });

  it("PATCH member updates promptOverride and writes operator-tagged activity", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members/${WORKER_ID}?cf_session=tok`,
      {
        body: JSON.stringify({ promptOverride: "novo prompt" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      member: {
        companyName: string;
        createdAt: number;
        promptOverride: string | null;
        templateSystemPrompt: string;
      };
    }>();
    expect(body.member.companyName).toBe("BT");
    expect(typeof body.member.createdAt).toBe("number");
    expect(body.member.promptOverride).toBe("novo prompt");
    expect(body.member.templateSystemPrompt).toBe("TPL_PROMPT");
    const log = await db((client) =>
      client.activityLog.findFirst({
        select: { actorId: true, payload: true },
        where: { refId: WORKER_ID, type: "MEMBER_PROMPT_EDITED" },
      }),
    );
    expect(log?.actorId).toBe("staff-1");
    expect(log?.payload).toMatchObject({ editedBy: "operator" });
  });
});

describe("backoffice team routes: cross-tenant", () => {
  it("STAFF queries another company's members list (empty when it has none)", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/co_other_company/members?cf_session=tok`,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ members: Array<{ id: string }> }>();
    expect(body.members).toEqual([]);
  });

  it("404 (not 403) when STAFF reads a member that doesn't exist in that company", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/co_other_company/members/${WORKER_ID}?cf_session=tok`,
    );
    expect(res.status).toBe(404);
  });

  it("404 (not 403) when STAFF PATCHes a member that doesn't exist in that company", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/co_other_company/members/${WORKER_ID}?cf_session=tok`,
      {
        body: JSON.stringify({ displayName: "evil" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("/api/backoffice/companies", () => {
  it("returns every company with its roster + brief completeness for STAFF", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/companies?cf_session=tok",
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      companies: Array<{ briefPercent: number; id: string; members: Array<{ id: string }> }>;
    }>();
    const co = body.companies.find((c) => c.id === COMPANY_ID);
    expect(co).toBeDefined();
    expect(typeof co?.briefPercent).toBe("number");
    expect(co?.members.some((m) => m.id === WORKER_ID)).toBe(true);
  });

  it("403 for CUSTOMER", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      "https://agents.test/api/backoffice/companies?cf_session=tok",
    );
    expect(res.status).toBe(403);
  });
});

describe("backoffice member detail extras + pause/resume", () => {
  it("member detail exposes companyName and createdAt", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members/${WORKER_ID}?cf_session=tok`,
    );
    const body = await res.json<{ member: { companyName: string; createdAt: number } }>();
    expect(body.member.companyName).toBe("BT");
    expect(typeof body.member.createdAt).toBe("number");
  });

  it("PATCH status pauses then resumes a worker", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const url = `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members/${WORKER_ID}?cf_session=tok`;
    const headers = { "content-type": "application/json" };

    const pause = await exports.default.fetch(url, {
      body: JSON.stringify({ status: "paused" }),
      headers,
      method: "PATCH",
    });
    expect(pause.status).toBe(200);
    const pauseBody = await pause.json<{ member: { status: string } }>();
    expect(pauseBody.member.status).toBe("paused");
    const row = await db((client) =>
      client.agentInstance.findUnique({ select: { status: true }, where: { id: WORKER_ID } }),
    );
    expect(row?.status).toBe("paused");

    const resume = await exports.default.fetch(url, {
      body: JSON.stringify({ status: "active" }),
      headers,
      method: "PATCH",
    });
    expect(resume.status).toBe(200);
    const resumeBody = await resume.json<{ member: { status: string } }>();
    expect(resumeBody.member.status).toBe("available");
  });

  it("returns 409 when pausing the correspondent", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/backoffice/teams/${COMPANY_ID}/members/${CORR_ID}?cf_session=tok`,
      {
        body: JSON.stringify({ status: "paused" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "cannot pause/resume a correspondent" });
  });
});
