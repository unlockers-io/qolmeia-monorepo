import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, entitle, seedCompany } from "#/__tests__/fixtures";

const COMPANY_ID = "co_confirm_test";
const ORIGINAL_FETCH = globalThis.fetch;

const meCustomer = {
  currentOrg: { id: COMPANY_ID, role: "CUSTOMER" },
  user: { id: "cust-1" },
};
const meOtherOrg = {
  currentOrg: { id: "co_other", role: "CUSTOMER" },
  user: { id: "cust-2" },
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, status: "onboarding" });
  await entitle(COMPANY_ID, ["tpl-designer"]);
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("POST /api/teams/:companyId/confirm", () => {
  it("rejects unauthenticated with 401", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
    const res = await exports.default.fetch(`https://agents.test/api/teams/${COMPANY_ID}/confirm`, {
      body: JSON.stringify({ templateIds: ["tpl-designer"] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("rejects a confirm for a different org with 403", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meOtherOrg)));
    const res = await exports.default.fetch(
      `https://agents.test/api/teams/${COMPANY_ID}/confirm?cf_session=tok`,
      {
        body: JSON.stringify({ templateIds: ["tpl-designer"] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid body (empty templateIds)", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      `https://agents.test/api/teams/${COMPANY_ID}/confirm?cf_session=tok`,
      {
        body: JSON.stringify({ templateIds: [] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(400);
  });

  it("materializes the team and flips company status to active", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const res = await exports.default.fetch(
      `https://agents.test/api/teams/${COMPANY_ID}/confirm?cf_session=tok`,
      {
        body: JSON.stringify({ templateIds: ["tpl-designer"] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ team: { correspondentId: string; teamId: string } }>();
    expect(body.team.correspondentId).toBe(`corr-${COMPANY_ID}`);

    const company = await db((client) =>
      client.company.findUnique({ select: { status: true }, where: { id: COMPANY_ID } }),
    );
    expect(company?.status).toBe("active");
  });
});
