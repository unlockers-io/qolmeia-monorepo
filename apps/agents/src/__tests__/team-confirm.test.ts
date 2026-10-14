import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, entitle, seedCompany } from "#/__tests__/fixtures";
import { confirmTeam } from "#/team/confirm";

const COMPANY_ID = "co_team_test";
const CORR_ID = `corr-${COMPANY_ID}`;
const TEAM_ID = `team-${COMPANY_ID}`;
const WORKER_ID = `worker-tpl-designer-${COMPANY_ID}`;

const confirm = (templateIds: ReadonlyArray<string> = ["tpl-designer"]) =>
  db((client) =>
    confirmTeam(env, client, { actorId: "cust-1", companyId: COMPANY_ID, templateIds }),
  );

const counts = () =>
  db(async (client) => ({
    instances: await client.agentInstance.count({ where: { companyId: COMPANY_ID } }),
    members: await client.teamMember.count({ where: { teamId: TEAM_ID } }),
    teams: await client.team.count({ where: { companyId: COMPANY_ID } }),
  }));

beforeEach(async () => {
  await seedCompany({
    brief: { audience: "Vizinhos", industry: "Padaria" },
    id: COMPANY_ID,
    status: "onboarding",
  });
  await entitle(COMPANY_ID, ["tpl-designer"]);
});

describe("confirmTeam", () => {
  it("inserts team + correspondent + workers + team_member rows atomically", async () => {
    const result = await confirm();
    expect(result).toEqual({ correspondentId: CORR_ID, teamId: TEAM_ID, workerIds: [WORKER_ID] });

    const team = await db((client) => client.team.findUnique({ where: { companyId: COMPANY_ID } }));
    expect(team?.id).toBe(TEAM_ID);
    expect(team?.confirmedAt).toBeInstanceOf(Date);

    const instances = await db((client) =>
      client.agentInstance.findMany({
        orderBy: { role: "asc" },
        select: { id: true, role: true, templateId: true },
        where: { companyId: COMPANY_ID },
      }),
    );
    expect(instances).toEqual([
      { id: CORR_ID, role: "correspondent", templateId: null },
      { id: WORKER_ID, role: "worker", templateId: "tpl-designer" },
    ]);
  });

  it("populates canDelegateTo so Correspondent → Designer is allowed", async () => {
    await confirm();
    const members = await db((client) =>
      client.teamMember.findMany({
        orderBy: { agentInstanceId: "asc" },
        select: { agentInstanceId: true, canDelegateTo: true },
        where: { teamId: TEAM_ID },
      }),
    );
    expect(members).toEqual([
      { agentInstanceId: CORR_ID, canDelegateTo: [WORKER_ID] },
      { agentInstanceId: WORKER_ID, canDelegateTo: [] },
    ]);
  });

  it("flips the company status to active", async () => {
    await confirm();
    const company = await db((client) =>
      client.company.findUnique({ select: { status: true }, where: { id: COMPANY_ID } }),
    );
    expect(company?.status).toBe("active");
  });

  it("is idempotent — re-running with the same templateIds doesn't duplicate", async () => {
    await confirm();
    await confirm();
    await expect(counts()).resolves.toEqual({ instances: 2, members: 2, teams: 1 });
  });

  it("rejects templates the company is not entitled to and writes nothing", async () => {
    await expect(confirm(["tpl-designer", "tpl-redator"])).rejects.toThrow(
      /template tpl-redator not found/v,
    );
    await expect(counts()).resolves.toEqual({ instances: 0, members: 0, teams: 0 });
    const company = await db((client) =>
      client.company.findUnique({ select: { status: true }, where: { id: COMPANY_ID } }),
    );
    expect(company?.status).toBe("onboarding");
  });

  it("rejects unknown templates", async () => {
    await expect(confirm(["tpl-does-not-exist"])).rejects.toThrow(/not found/v);
  });

  it("records exactly one TEAM_CONFIRMED activity row", async () => {
    await confirm();
    const rows = await db((client) =>
      client.activityLog.findMany({
        select: { actorId: true, payload: true, refId: true, refType: true },
        where: { companyId: COMPANY_ID, type: "TEAM_CONFIRMED" },
      }),
    );
    expect(rows).toEqual([
      {
        actorId: "cust-1",
        payload: {
          correspondentId: CORR_ID,
          teamId: TEAM_ID,
          templateIds: ["tpl-designer"],
          workerIds: [WORKER_ID],
        },
        refId: TEAM_ID,
        refType: "team",
      },
    ]);
  });

  it("seeds the correspondent's memory with facts derived from the company brief", async () => {
    await confirm();
    const facts = await db((client) =>
      client.memoryFact.findMany({
        orderBy: { kind: "asc" },
        select: { agentInstanceId: true, content: true, kind: true },
        where: { companyId: COMPANY_ID },
      }),
    );
    expect(facts).toEqual([
      { agentInstanceId: CORR_ID, content: "Público: Vizinhos", kind: "audience" },
      { agentInstanceId: CORR_ID, content: "Setor: Padaria", kind: "industry" },
      {
        agentInstanceId: CORR_ID,
        content: "Time confirmado via onboarding.",
        kind: "onboarding_summary",
      },
    ]);
  });
});
