import { beforeEach, describe, expect, it } from "vitest";

import { entitle, seedCompany, seedTeam } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";

const COMPANY_ID = "co_meteam_test";

const meCustomer: Persona = { orgId: COMPANY_ID, role: "CUSTOMER", userId: "user-1" };
const meStaff: Persona = { orgId: COMPANY_ID, role: "STAFF", userId: "staff-1" };

const WORKER_ID = "ai_mt_d";

let cookie = "";

beforeEach(async () => {
  cookie = "";
  await seedCompany({ id: COMPANY_ID, name: "MT" });
  await entitle(COMPANY_ID);
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
});

describe("GET /api/me/team", () => {
  it("returns the roster for CUSTOMER", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team");
    expect(res.status).toBe(200);
    const body = await res.json<{
      members: Array<{ displayName: string; id: string; status: string }>;
    }>();
    expect(body.members.some((m) => m.id === WORKER_ID)).toBe(true);
  });

  it("refuses an Operator: the customer surface is CUSTOMER-only", async () => {
    cookie = await signInAs(meStaff);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team");
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated with 401", async () => {
    cookie = "";
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/me/catalogue", () => {
  it("returns active worker templates with hiredCount", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/catalogue");
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
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team/hire", {
      body: JSON.stringify({ templateId: "tpl-designer" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ member: { id: string; templateId: string } }>();
    expect(body.member.templateId).toBe("tpl-designer");
  });

  it("400 when templateId missing", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team/hire", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(400);
  });
});

describe("/api/me/team mutations: CUSTOMER role gate", () => {
  it("403 when STAFF tries to hire", async () => {
    cookie = await signInAs(meStaff);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team/hire", {
      body: JSON.stringify({ templateId: "tpl-designer" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  it("403 when STAFF tries to pause", async () => {
    cookie = await signInAs(meStaff);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/me/team/members/${WORKER_ID}/pause`,
      { method: "POST" },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/me/team/hire: error mapping", () => {
  it("404 when template doesn't exist", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team/hire", {
      body: JSON.stringify({ templateId: "tpl-does-not-exist" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/me/team/members/:id", () => {
  it("renames + sets prompt override", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team/members/ai_mt_d", {
      body: JSON.stringify({ displayName: "Marina", promptOverride: "minimalista" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(200);
    const body = await res.json<{
      member: { displayName: string; hasPromptOverride: boolean };
    }>();
    expect(body.member.displayName).toBe("Marina");
    expect(body.member.hasPromptOverride).toBe(true);
  });

  it("clears prompt override when promptOverride: null", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/team/members/ai_mt_d", {
      body: JSON.stringify({ promptOverride: null }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ member: { hasPromptOverride: boolean } }>();
    expect(body.member.hasPromptOverride).toBe(false);
  });

  it("404 when the member doesn't belong to the company", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      "https://agents.test/api/me/team/members/ai_does_not_exist",
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
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/me/team/members/${WORKER_ID}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{
      member: { id: string; promptOverride: string | null; templateSystemPrompt: string };
    }>();
    expect(body.member.id).toBe(WORKER_ID);
  });

  it("404 when the member doesn't belong to the company", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/me/team/members/ai_does_not_exist`,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/me/team/members/:id/pause + /resume", () => {
  it("pauses then resumes the worker", async () => {
    cookie = await signInAs(meCustomer);
    const paused = await fetchWithCookie(
      cookie,
      "https://agents.test/api/me/team/members/ai_mt_d/pause",
      { method: "POST" },
    );
    expect(paused.status).toBe(200);
    const pausedBody = await paused.json<{ member: { status: string } }>();
    expect(pausedBody.member.status).toBe("paused");

    const resumed = await fetchWithCookie(
      cookie,
      "https://agents.test/api/me/team/members/ai_mt_d/resume",
      { method: "POST" },
    );
    const resumedBody = await resumed.json<{ member: { status: string } }>();
    expect(resumedBody.member.status).toBe("available");
  });

  it("rejects pausing the correspondent with the same 409 the operator surface returns", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/me/team/members/corr-${COMPANY_ID}/pause`,
      { method: "POST" },
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "cannot pause/resume a correspondent" });
  });

  it("returns 404 when pausing a member outside the company", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      "https://agents.test/api/me/team/members/ai_does_not_exist/pause",
      { method: "POST" },
    );
    expect(res.status).toBe(404);
  });
});
