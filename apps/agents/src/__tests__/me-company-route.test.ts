import { beforeEach, describe, expect, it } from "vitest";

import { seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";

const COMPANY_ID = "co_mecompany_test";

const meCustomer: Persona = { orgId: COMPANY_ID, role: "CUSTOMER", userId: "user-1" };
const meStaff: Persona = { orgId: COMPANY_ID, role: "STAFF", userId: "staff-1" };

type CompanyBody = {
  company: { brief: Record<string, unknown>; status: string };
  completeness: { isComplete: boolean; missing: Array<string>; percent: number };
};

let cookie = "";

beforeEach(async () => {
  cookie = "";
  await seedCompany({ id: COMPANY_ID, status: "onboarding" });
});

describe("GET /api/me/company", () => {
  it("returns an empty brief with 0% completeness", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/company");
    expect(res.status).toBe(200);
    const body = await res.json<CompanyBody>();
    expect(body.completeness.percent).toBe(0);
    expect(body.completeness.isComplete).toBe(false);
  });
});

describe("PATCH /api/me/company", () => {
  it("merges a partial brief and recomputes completeness", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/company", {
      body: JSON.stringify({ industry: "alimentação" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(200);
    const body = await res.json<CompanyBody>();
    expect(body.company.brief.industry).toBe("alimentação");
    expect(body.completeness.missing).toContain("primaryGoal");
    expect(body.completeness.percent).toBe(17);
  });

  it("preserves earlier fields across successive patches", async () => {
    cookie = await signInAs(meCustomer);
    await fetchWithCookie(cookie, "https://agents.test/api/me/company", {
      body: JSON.stringify({ industry: "alimentação" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/company", {
      body: JSON.stringify({ primaryGoal: "vender mais" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    const body = await res.json<CompanyBody>();
    expect(body.company.brief.industry).toBe("alimentação");
    expect(body.company.brief.primaryGoal).toBe("vender mais");
  });

  it("403 when STAFF tries to edit the brief", async () => {
    cookie = await signInAs(meStaff);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/company", {
      body: JSON.stringify({ industry: "x" }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(403);
  });

  it("400 on an invalid body", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/company", {
      body: JSON.stringify({ channels: ["not-a-channel"] }),
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
    expect(res.status).toBe(400);
  });
});
