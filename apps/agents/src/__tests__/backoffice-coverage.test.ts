import type { OperatorCoverage } from "@repo/worker-api/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";
import { proposeAction } from "#/action/approval";
import { getCoverage, getCoverageOptions, setCoverage } from "#/operator/assignment";

const COMPANY_A = "co_cov_a";
const COMPANY_B = "co_cov_b";
const OPERATOR = "op-cov-1";

const meStaff: Persona = { orgId: "qolmeia-internal", role: "STAFF", userId: OPERATOR };

const seedPendingAction = async (input: {
  companyId: string;
  displayName: string;
  templateId: string;
}) => {
  const workerId = `ai-${input.companyId}`;
  const ticketId = `tkt-${input.companyId}`;
  await seedCompany({ id: input.companyId, name: input.displayName });
  await seedTeam(input.companyId, [
    { displayName: input.displayName, id: workerId, templateId: input.templateId },
  ]);
  await seedTicket({ agentInstanceId: workerId, companyId: input.companyId, id: ticketId });
  await db((client) =>
    proposeAction(client, {
      actionType: "publish_post",
      companyId: input.companyId,
      feedback: null,
      policy: "require_approval",
      proposed: { summary: input.displayName },
      round: 0,
      summary: input.displayName,
      ticketId,
    }),
  );
};

const cover = (coverage: OperatorCoverage) =>
  db((client) => setCoverage(client, OPERATOR, coverage));

let cookie = "";

beforeEach(async () => {
  cookie = "";
  await seedPendingAction({
    companyId: COMPANY_A,
    displayName: "Cov A",
    templateId: "tpl-designer",
  });
  await seedPendingAction({
    companyId: COMPANY_B,
    displayName: "Cov B",
    templateId: "tpl-redator",
  });
});

const pendingCompanyIds = async (query = ""): Promise<Array<string>> => {
  const res = await fetchWithCookie(
    cookie,
    `https://agents.test/api/backoffice/actions?status=pending${query}`,
  );
  const body = await res.json<{ items: Array<{ companyId: string }> }>();
  return body.items.map((a) => a.companyId);
};

describe("operator coverage DB", () => {
  it("round-trips coverage and lists discipline options by worker kind", async () => {
    await cover({ companies: [COMPANY_A], disciplines: ["designer"] });
    let coverage = await db((client) => getCoverage(client, OPERATOR));
    expect(coverage.companies).toEqual([COMPANY_A]);
    expect(coverage.disciplines).toEqual(["designer"]);

    await cover({ companies: [], disciplines: ["redator"] });
    coverage = await db((client) => getCoverage(client, OPERATOR));
    expect(coverage.companies).toEqual([]);
    expect(coverage.disciplines).toEqual(["redator"]);

    const options = await db((client) => getCoverageOptions(client));
    expect(options.disciplines).toContain("designer");
    expect(options.disciplines).toContain("redator");
    expect(options.disciplineNames).toMatchObject({ designer: "Designer", redator: "Redator" });
  });
});

describe("GET/PUT /api/backoffice/assignments/me", () => {
  it("returns empty coverage + option lists, then reflects a PUT", async () => {
    cookie = await signInAs(meStaff);
    const before = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/assignments/me",
    );
    const beforeBody = await before.json<{
      assigned: { companies: Array<string>; disciplines: Array<string> };
      options: {
        companies: Array<{ id: string }>;
        disciplineNames?: Record<string, string>;
        disciplines: Array<string>;
      };
    }>();
    expect(beforeBody.assigned.companies).toEqual([]);
    expect(beforeBody.options.companies.some((co) => co.id === COMPANY_A)).toBe(true);
    expect(beforeBody.options.disciplines).toContain("designer");
    expect(beforeBody.options.disciplineNames).toMatchObject({ designer: "Designer" });

    const put = await fetchWithCookie(cookie, "https://agents.test/api/backoffice/assignments/me", {
      body: JSON.stringify({ companies: [COMPANY_A], disciplines: [] }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    expect(put.status).toBe(200);
    const after = await fetchWithCookie(
      cookie,
      "https://agents.test/api/backoffice/assignments/me",
    );
    const afterBody = await after.json<{ assigned: { companies: Array<string> } }>();
    expect(afterBody.assigned.companies).toEqual([COMPANY_A]);
  });
});

describe("approval queue narrows to coverage", () => {
  it("no coverage = sees every company", async () => {
    cookie = await signInAs(meStaff);
    const ids = await pendingCompanyIds();
    expect(ids).toContain(COMPANY_A);
    expect(ids).toContain(COMPANY_B);
  });

  it("company coverage filters the queue to that company", async () => {
    await cover({ companies: [COMPANY_A], disciplines: [] });
    cookie = await signInAs(meStaff);
    const ids = await pendingCompanyIds();
    expect(ids).toContain(COMPANY_A);
    expect(ids).not.toContain(COMPANY_B);
  });

  it("discipline coverage filters by the producing agent's worker_kind", async () => {
    await cover({ companies: [], disciplines: ["redator"] });
    cookie = await signInAs(meStaff);
    const ids = await pendingCompanyIds();
    expect(ids).toContain(COMPANY_B);
    expect(ids).not.toContain(COMPANY_A);
  });

  it("explicit ?companyId= drills past coverage", async () => {
    await cover({ companies: [COMPANY_A], disciplines: [] });
    cookie = await signInAs(meStaff);
    const ids = await pendingCompanyIds(`&companyId=${COMPANY_B}`);
    expect(ids).toContain(COMPANY_B);
    expect(ids).not.toContain(COMPANY_A);
  });
});
