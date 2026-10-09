import { beforeEach, describe, expect, it } from "vitest";

import { db, entitle, seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";

const COMPANY_ID = "co_confirm_test";

const meCustomer: Persona = { orgId: COMPANY_ID, role: "CUSTOMER", userId: "cust-1" };
const meOtherOrg: Persona = { orgId: "co_other", role: "CUSTOMER", userId: "cust-2" };

let cookie = "";

beforeEach(async () => {
  cookie = "";
  await seedCompany({ id: COMPANY_ID, status: "onboarding" });
  await entitle(COMPANY_ID, ["tpl-designer"]);
});

describe("POST /api/teams/:companyId/confirm", () => {
  it("rejects unauthenticated with 401", async () => {
    cookie = "";
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/teams/${COMPANY_ID}/confirm`,
      {
        body: JSON.stringify({ templateIds: ["tpl-designer"] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(401);
  });

  it("rejects a confirm for a different org with 403", async () => {
    cookie = await signInAs(meOtherOrg);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/teams/${COMPANY_ID}/confirm`,
      {
        body: JSON.stringify({ templateIds: ["tpl-designer"] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid body (empty templateIds)", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/teams/${COMPANY_ID}/confirm`,
      {
        body: JSON.stringify({ templateIds: [] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(res.status).toBe(400);
  });

  it("materializes the team and flips company status to active", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(
      cookie,
      `https://agents.test/api/teams/${COMPANY_ID}/confirm`,
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
