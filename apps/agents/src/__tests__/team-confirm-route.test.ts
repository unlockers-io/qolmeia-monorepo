import type { ConfirmTeamResponse } from "@repo/worker-api/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { db, entitle, seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";

const COMPANY_ID = "co_confirm_test";

const meCustomer: Persona = { orgId: COMPANY_ID, role: "CUSTOMER", userId: "cust-1" };

const confirm = (cookie: string, templateIds: ReadonlyArray<string>) =>
  fetchWithCookie(cookie, "https://agents.test/api/me/team/confirm", {
    body: JSON.stringify({ templateIds }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, status: "onboarding" });
  await entitle(COMPANY_ID, ["tpl-designer"]);
});

describe("POST /api/me/team/confirm", () => {
  it("rejects unauthenticated with 401", async () => {
    const res = await confirm("", ["tpl-designer"]);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid body (empty templateIds)", async () => {
    const res = await confirm(await signInAs(meCustomer), []);
    expect(res.status).toBe(400);
  });

  it("materializes the caller's team and flips company status to active", async () => {
    const res = await confirm(await signInAs(meCustomer), ["tpl-designer"]);

    expect(res.status).toBe(200);
    const body = await res.json<ConfirmTeamResponse>();
    expect(body.team.correspondentId).toBe(`corr-${COMPANY_ID}`);

    const company = await db((client) =>
      client.company.findUnique({ select: { status: true }, where: { id: COMPANY_ID } }),
    );

    expect(company?.status).toBe("active");
  });
});
