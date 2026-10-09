import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { entitle, seedCompany, seedTeam } from "#/__tests__/fixtures";

const COMPANY_ID = "co_meteam_test";
const originalFetch = globalThis.fetch;

const meCustomer = {
  currentOrg: { id: COMPANY_ID, role: "CUSTOMER" },
  user: { id: "user-1" },
};
const meStaff = {
  currentOrg: { id: COMPANY_ID, role: "STAFF" },
  user: { id: "staff-1" },
};

const WORKER_ID = "ai_mt_d";

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, name: "MT" });
  await entitle(COMPANY_ID);
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /api/me/team", () => {
  it("returns the roster for CUSTOMER", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch("https://agents.test/api/me/team?cf_session=tok");
    expect(res.status).toBe(200);
    const body = await res.json<{
      members: Array<{ displayName: string; id: string; status: string }>;
    }>();
    expect(body.members.some((m) => m.id === WORKER_ID)).toBe(true);
  });

  it("admits STAFF reading their own company's team", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch("https://agents.test/api/me/team?cf_session=tok");
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated with 401", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
    const res = await exports.default.fetch("https://agents.test/api/me/team?cf_session=tok");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/me/catalogue", () => {
  it("returns active worker templates with hiredCount", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch("https://agents.test/api/me/catalogue?cf_session=tok");
    expect(res.status).toBe(200);
    const body = await res.json<{
      templates: Array<{ hiredCount: number; id: string }>;
    }>();
    const designer = body.templates.find((t) => t.id === "tpl-designer");
    expect(designer?.hiredCount).toBe(1);
  });
});

describe("POST /api/me/team/hire", () => {
  it("creates a new instance and emits team:roster", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch("https://agents.test/api/me/team/hire?cf_session=tok", {
      body: JSON.stringify({ templateId: "tpl-designer" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ member: { id: string; templateId: string } }>();
    expect(body.member.templateId).toBe("tpl-designer");
  });

  it("400 when templateId missing", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch("https://agents.test/api/me/team/hire?cf_session=tok", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(400);
  });
});

describe("/api/me/team mutations: CUSTOMER role gate", () => {
  it("403 when STAFF tries to hire", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch("https://agents.test/api/me/team/hire?cf_session=tok", {
      body: JSON.stringify({ templateId: "tpl-designer" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  it("403 when STAFF tries to pause", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const res = await exports.default.fetch(
      `https://agents.test/api/me/team/members/${WORKER_ID}/pause?cf_session=tok`,
      { method: "POST" },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/me/team/hire: error mapping", () => {
  it("404 when template doesn't exist", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch("https://agents.test/api/me/team/hire?cf_session=tok", {
      body: JSON.stringify({ templateId: "tpl-does-not-exist" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/me/team/members/:id", () => {
  it("renames + sets prompt override", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      "https://agents.test/api/me/team/members/ai_mt_d?cf_session=tok",
      {
        body: JSON.stringify({ displayName: "Marina", promptOverride: "minimalista" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      member: { displayName: string; hasPromptOverride: boolean };
    }>();
    expect(body.member.displayName).toBe("Marina");
    expect(body.member.hasPromptOverride).toBe(true);
  });

  it("clears prompt override when promptOverride: null", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      "https://agents.test/api/me/team/members/ai_mt_d?cf_session=tok",
      {
        body: JSON.stringify({ promptOverride: null }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ member: { hasPromptOverride: boolean } }>();
    expect(body.member.hasPromptOverride).toBe(false);
  });

  it("404 when the member doesn't belong to the company", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      "https://agents.test/api/me/team/members/ai_does_not_exist?cf_session=tok",
      {
        body: JSON.stringify({ displayName: "x" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/me/team/members/:id", () => {
  it("returns the detail view for a member of the customer's company", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      `https://agents.test/api/me/team/members/${WORKER_ID}?cf_session=tok`,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      member: { id: string; promptOverride: string | null; templateSystemPrompt: string };
    }>();
    expect(body.member.id).toBe(WORKER_ID);
  });

  it("404 when the member doesn't belong to the company", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      `https://agents.test/api/me/team/members/ai_does_not_exist?cf_session=tok`,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/me/team/members/:id/pause + /resume", () => {
  it("pauses then resumes the worker", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const paused = await exports.default.fetch(
      "https://agents.test/api/me/team/members/ai_mt_d/pause?cf_session=tok",
      { method: "POST" },
    );
    expect(paused.status).toBe(200);
    const pausedBody = await paused.json<{ member: { status: string } }>();
    expect(pausedBody.member.status).toBe("paused");

    const resumed = await exports.default.fetch(
      "https://agents.test/api/me/team/members/ai_mt_d/resume?cf_session=tok",
      { method: "POST" },
    );
    const resumedBody = await resumed.json<{ member: { status: string } }>();
    expect(resumedBody.member.status).toBe("available");
  });

  it("rejects pausing the correspondent with the same 409 the operator surface returns", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      `https://agents.test/api/me/team/members/corr-${COMPANY_ID}/pause?cf_session=tok`,
      { method: "POST" },
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "cannot pause/resume a correspondent" });
  });

  it("returns 404 when pausing a member outside the company", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      "https://agents.test/api/me/team/members/ai_does_not_exist/pause?cf_session=tok",
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});
