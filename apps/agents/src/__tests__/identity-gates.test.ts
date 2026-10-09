import type { MeResponse, SignupState } from "@repo/worker-api/contracts";
import { describe, expect, it } from "vitest";

import { seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signIn, signInAs } from "#/__tests__/sign-in";

const COMPANY_ID = "co_gates_test";
const OTHER_COMPANY_ID = "co_gates_other";
const QOLMEIA_ORG_ID = "org_qolmeia_gates";

const call = (path: string, cookie = "", init: RequestInit = {}) =>
  fetchWithCookie(cookie, `https://agents.test${path}`, init);

const statusOf = async (path: string, cookie = "", init: RequestInit = {}) => {
  const res = await call(path, cookie, init);
  return res.status;
};

const signupIsOpen = async () => {
  const res = await call("/api/signup");
  const body = await res.json<SignupState>();
  return body.open;
};

describe("GET /api/me", () => {
  it("is 401 without a session", async () => {
    expect(await statusOf("/api/me")).toBe(401);
  });

  it("answers the user and every membership, oldest first, in-process", async () => {
    const cookie = await signIn([
      { orgId: QOLMEIA_ORG_ID, role: "OWNER" },
      { orgId: COMPANY_ID, role: "CUSTOMER" },
    ]);
    const res = await call("/api/me", cookie);
    expect(res.status).toBe(200);
    const body = await res.json<MeResponse>();
    expect(body.user.email).toMatch(/@qolmeia\.test$/v);
    expect(body.orgs.map(({ id, role }) => ({ id, role }))).toEqual([
      { id: QOLMEIA_ORG_ID, role: "OWNER" },
      { id: COMPANY_ID, role: "CUSTOMER" },
    ]);
  });
});

describe("operator REST", () => {
  it("is 401 without a session", async () => {
    expect(await statusOf("/api/backoffice/companies")).toBe(401);
  });

  it("refuses a Customer", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    expect(await statusOf("/api/backoffice/companies", cookie)).toBe(403);
  });

  it.each(["OWNER", "STAFF"] as const)("admits %s across tenants", async (role) => {
    await seedCompany({ id: COMPANY_ID });
    const cookie = await signInAs({ orgId: QOLMEIA_ORG_ID, role });
    const res = await call(`/api/backoffice/tickets?companyId=${COMPANY_ID}`, cookie);
    expect(res.status).toBe(200);
  });

  it("admits an Operator who is also a Customer", async () => {
    const cookie = await signIn([
      { orgId: COMPANY_ID, role: "CUSTOMER" },
      { orgId: QOLMEIA_ORG_ID, role: "STAFF" },
    ]);
    expect(await statusOf("/api/backoffice/companies", cookie)).toBe(200);
  });
});

describe("customer REST", () => {
  it("is 401 without a session", async () => {
    expect(await statusOf("/api/me/company")).toBe(401);
  });

  it("refuses an Operator, for reads as well as writes", async () => {
    const cookie = await signInAs({ orgId: QOLMEIA_ORG_ID, role: "OWNER" });
    expect(await statusOf("/api/me/company", cookie)).toBe(403);
  });

  it("serves the Customer's own Company", async () => {
    await seedCompany({ id: COMPANY_ID, status: "onboarding" });
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    const res = await call("/api/me/company", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ company: { id: COMPANY_ID } });
  });

  it("serves an account on both surfaces its Customer Company", async () => {
    await seedCompany({ id: COMPANY_ID, status: "onboarding" });
    const cookie = await signIn([
      { orgId: QOLMEIA_ORG_ID, role: "OWNER" },
      { orgId: COMPANY_ID, role: "CUSTOMER" },
    ]);
    const res = await call("/api/me/company", cookie);
    expect(await res.json()).toMatchObject({ company: { id: COMPANY_ID } });
  });

  it("refuses a team confirm for another tenant's path", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    const status = await statusOf(`/api/teams/${OTHER_COMPANY_ID}/confirm`, cookie, {
      body: JSON.stringify({ templateIds: ["tpl-designer"] }),
      method: "POST",
    });
    expect(status).toBe(403);
  });
});

describe("agent paths", () => {
  it("is 401 without a session", async () => {
    expect(await statusOf(`/agents/correspondent/${COMPANY_ID}`)).toBe(401);
  });

  it.each(["correspondent", "planner"])("refuses another tenant's %s", async (agent) => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    expect(await statusOf(`/agents/${agent}/${OTHER_COMPANY_ID}`, cookie)).toBe(403);
  });

  it("refuses a path that names no tenant", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    expect(await statusOf("/agents/correspondent", cookie)).toBe(403);
  });

  it("refuses an Operator even on a tenant it could name", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "OWNER" });
    expect(await statusOf(`/agents/correspondent/${COMPANY_ID}`, cookie)).toBe(403);
  });
});

describe("Better Auth on the Worker", () => {
  it("serves /api/auth/* and reads the session it issued", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    const res = await call("/api/auth/get-session", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { email: expect.stringMatching(/@/v) } });
  });

  it("closes operator sign-up once an operator exists", async () => {
    const before = await signupIsOpen();
    await signInAs({ orgId: QOLMEIA_ORG_ID, role: "OWNER" });
    expect([before, await signupIsOpen()]).toEqual([true, false]);
  });
});
