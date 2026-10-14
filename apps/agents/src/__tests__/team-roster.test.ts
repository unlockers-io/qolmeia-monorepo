import { beforeEach, describe, expect, it } from "vitest";

import { db, entitle, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { getCatalogue, getMemberDetail, getTeamRoster, listTeamRosters } from "#/team/roster";

const COMPANY_ID = "co_roster_test";
const CORR_ID = `corr-${COMPANY_ID}`;
const WORKER_ID = "worker_roster_test";
const OTHER_COMPANY_ID = "co_roster_other";
const OTHER_WORKER_ID = "worker_roster_other";

const createTemplate = (id: string, displayName: string, workerKind: string) =>
  db((client) =>
    client.agentTemplate.create({
      data: {
        defaultPolicies: {},
        description: "desc",
        displayName,
        id,
        model: "gpt-x",
        skillIds: [],
        systemPrompt: "sys",
        workerKind,
      },
    }),
  );

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, name: "R" });
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
  await db((client) =>
    client.agentInstance.update({ data: { promptOverride: "meu" }, where: { id: WORKER_ID } }),
  );
  await seedCompany({ id: OTHER_COMPANY_ID, name: "Other" });
  await db((client) =>
    client.agentInstance.create({
      data: {
        companyId: OTHER_COMPANY_ID,
        displayName: "Outro Designer",
        id: OTHER_WORKER_ID,
        role: "worker",
        templateId: "tpl-designer",
        templateVersion: 1,
      },
    }),
  );
  await seedTicket({
    agentInstanceId: WORKER_ID,
    brief: "Logo final",
    companyId: COMPANY_ID,
    id: "tkt_r1",
  });
  await seedTicket({
    agentInstanceId: WORKER_ID,
    brief: "Banner antigo",
    companyId: COMPANY_ID,
    id: "tkt_r2",
    status: "done",
  });
});

describe("getTeamRoster", () => {
  it("returns the correspondent and worker with derived status + current work + counts", async () => {
    const roster = await db((client) => getTeamRoster(client, COMPANY_ID));
    const designer = roster.find((m) => m.id === WORKER_ID);
    const correspondent = roster.find((m) => m.id === CORR_ID);

    expect(correspondent).toMatchObject({
      displayName: "Correspondente",
      hasPromptOverride: false,
      role: "correspondent",
      status: "available",
      templateId: null,
      templateName: null,
      workerKind: null,
    });

    expect(designer).toMatchObject({
      displayName: "Designer",
      hasPromptOverride: true,
      lifetimeDone: 1,
      role: "worker",
      status: "working",
      templateId: "tpl-designer",
      templateName: "Designer",
      workerKind: "designer",
    });
    expect(designer?.currentWork).toEqual([
      { status: "in_progress", summary: "Logo final", ticketId: "tkt_r1" },
    ]);
  });

  it("orders correspondent first, then by recent activity, then alphabetical", async () => {
    const roster = await db((client) => getTeamRoster(client, COMPANY_ID));
    expect(roster[0]?.role).toBe("correspondent");
  });

  it("throws if a worker row is missing template_id (data corruption guard)", async () => {
    await db((client) =>
      client.agentInstance.create({
        data: { companyId: COMPANY_ID, displayName: "broken", id: "worker_no_tpl", role: "worker" },
      }),
    );
    await expect(db((client) => getTeamRoster(client, COMPANY_ID))).rejects.toThrow(
      /worker .* missing/v,
    );
  });

  it("loads multiple company rosters without mixing work", async () => {
    const rosters = await db((client) => listTeamRosters(client, [COMPANY_ID, OTHER_COMPANY_ID]));

    expect(rosters.get(COMPANY_ID)?.some((m) => m.id === WORKER_ID)).toBe(true);
    expect(rosters.get(COMPANY_ID)?.some((m) => m.id === OTHER_WORKER_ID)).toBe(false);
    expect(rosters.get(OTHER_COMPANY_ID)?.map((m) => m.id)).toEqual([OTHER_WORKER_ID]);
  });
});

describe("getCatalogue", () => {
  it("returns active worker templates with per-template hiredCount for this company", async () => {
    await entitle(COMPANY_ID, ["tpl-designer"]);
    const items = await db((client) => getCatalogue(client, COMPANY_ID));
    const designer = items.find((t) => t.id === "tpl-designer");
    expect(designer).toMatchObject({
      hiredCount: 1,
      workerKind: "designer",
    });
  });

  it("returns 0 for templates with no hires on this company", async () => {
    await createTemplate("tpl-fresh", "Novo Tipo", "newkind");
    await entitle(COMPANY_ID, ["tpl-fresh"]);
    const items = await db((client) => getCatalogue(client, COMPANY_ID));
    expect(items.find((t) => t.id === "tpl-fresh")?.hiredCount).toBe(0);
  });

  it("returns only templates the company is entitled to", async () => {
    await createTemplate("tpl-entitled-only", "Entitled", "entitled");
    await entitle(COMPANY_ID, ["tpl-entitled-only"]);

    const items = await db((client) => getCatalogue(client, COMPANY_ID));

    expect(items.map((item) => item.id)).toEqual(["tpl-entitled-only"]);
  });
});

describe("getMemberDetail", () => {
  it("returns the template prompt and override + last edited timestamp", async () => {
    await db((client) =>
      client.agentTemplate.update({
        data: { description: "cria imagens", systemPrompt: "TEMPLATE_PROMPT" },
        where: { id: "tpl-designer" },
      }),
    );
    await db((client) =>
      client.activityLog.create({
        data: {
          companyId: COMPANY_ID,
          createdAt: new Date(1234),
          id: "al_pe",
          payload: {},
          refId: WORKER_ID,
          refType: "agent_instance",
          summary: "edited",
          type: "MEMBER_PROMPT_EDITED",
        },
      }),
    );

    const detail = await db((client) => getMemberDetail(client, COMPANY_ID, WORKER_ID));
    expect(detail).toMatchObject({
      capabilities: "cria imagens",
      hasPromptOverride: true,
      id: WORKER_ID,
      promptOverride: "meu",
      promptOverrideUpdatedAt: 1234,
      templateSystemPrompt: "TEMPLATE_PROMPT",
    });
  });

  it("returns null promptOverrideUpdatedAt when no edit log row exists", async () => {
    await db((client) =>
      client.agentInstance.update({ data: { promptOverride: null }, where: { id: WORKER_ID } }),
    );
    const detail = await db((client) => getMemberDetail(client, COMPANY_ID, WORKER_ID));
    expect(detail?.hasPromptOverride).toBe(false);
    expect(detail?.promptOverride).toBeNull();
    expect(detail?.promptOverrideUpdatedAt).toBeNull();
  });

  it("returns null when the instance doesn't belong to that company", async () => {
    const detail = await db((client) => getMemberDetail(client, OTHER_COMPANY_ID, WORKER_ID));
    expect(detail).toBeNull();
  });
});
