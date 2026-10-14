import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, entitle, seedCompany, seedTeam } from "#/__tests__/fixtures";
import { confirmTeam } from "#/team/confirm";
import { hireMember } from "#/team/members";
import { delegateTicket } from "#/ticket/delegation";

const COMPANY_ID = "co_use_case_tx";
const CORR_ID = `corr-${COMPANY_ID}`;
const GUARDED_TABLES = ["activity_log", "memory_fact"] as const;

const failInsertsInto = (table: (typeof GUARDED_TABLES)[number]) =>
  db(async (client) => {
    await client.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION reject_insert() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'injected failure'; END $$`,
    );
    await client.$executeRawUnsafe(
      `CREATE TRIGGER reject_insert BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_insert()`,
    );
  });

const rowCounts = () =>
  db(async (client) => ({
    activity: await client.activityLog.count(),
    facts: await client.memoryFact.count(),
    instances: await client.agentInstance.count(),
    teams: await client.team.count(),
    tickets: await client.ticket.count(),
  }));

afterEach(async () => {
  vi.restoreAllMocks();
  await db(async (client) => {
    for (const table of GUARDED_TABLES) {
      await client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS reject_insert ON ${table}`);
    }
  });
});

describe("team confirm", () => {
  beforeEach(async () => {
    await seedCompany({
      brief: { audience: "Vizinhos", industry: "Padaria" },
      id: COMPANY_ID,
      status: "onboarding",
    });
    await entitle(COMPANY_ID, ["tpl-designer", "tpl-redator"]);
  });

  it("writes nothing when the last write of the use case fails", async () => {
    await failInsertsInto("memory_fact");

    await expect(
      db((client) =>
        confirmTeam(env, client, {
          actorId: "cust-1",
          companyId: COMPANY_ID,
          templateIds: ["tpl-designer", "tpl-redator"],
        }),
      ),
    ).rejects.toThrow(/injected failure/v);

    await expect(rowCounts()).resolves.toEqual({
      activity: 0,
      facts: 0,
      instances: 0,
      teams: 0,
      tickets: 0,
    });
    const company = await db((client) => client.company.findUnique({ where: { id: COMPANY_ID } }));
    expect(company?.status).toBe("onboarding");
  });

  it("commits the team, its activity entry and the brief facts together", async () => {
    await db((client) =>
      confirmTeam(env, client, {
        actorId: "cust-1",
        companyId: COMPANY_ID,
        templateIds: ["tpl-designer", "tpl-redator"],
      }),
    );

    await expect(rowCounts()).resolves.toEqual({
      activity: 1,
      facts: 3,
      instances: 3,
      teams: 1,
      tickets: 0,
    });
  });
});

describe("hire", () => {
  beforeEach(async () => {
    await seedCompany({ id: COMPANY_ID });
    await entitle(COMPANY_ID);
    await seedTeam(COMPANY_ID);
  });

  it("writes nothing when the activity entry fails", async () => {
    await failInsertsInto("activity_log");

    await expect(
      db((client) =>
        hireMember(env, client, {
          actorId: "cust-1",
          companyId: COMPANY_ID,
          displayName: undefined,
          templateId: "tpl-designer",
        }),
      ),
    ).rejects.toThrow(/injected failure/v);

    const [instances, correspondent] = await db((client) =>
      Promise.all([
        client.agentInstance.count({ where: { role: "worker" } }),
        client.teamMember.findFirst({ where: { agentInstanceId: CORR_ID } }),
      ]),
    );
    expect(instances).toBe(0);
    expect(correspondent?.canDelegateTo).toEqual([]);
  });
});

describe("delegation", () => {
  beforeEach(async () => {
    await seedCompany({ id: COMPANY_ID });
    await seedTeam(COMPANY_ID, [{ id: "wkr_tx_designer" }]);
  });

  it("creates the ticket already linked to its Workflow", async () => {
    vi.spyOn(env.WORKER_JOB, "create").mockResolvedValue({ id: "stub" } as WorkflowInstance);

    const result = await db((client) =>
      delegateTicket(env, client, {
        brief: "criar logo",
        companyId: COMPANY_ID,
        delegatorId: CORR_ID,
        workerKind: "designer",
      }),
    );

    expect(result).toMatchObject({ status: "queued" });
    const ticket = await db((client) => client.ticket.findFirst());
    expect(ticket).toMatchObject({
      agentInstanceId: "wkr_tx_designer",
      status: "in_progress",
      workflowId: ticket?.id,
    });
  });

  it("removes the ticket when the Workflow cannot be created", async () => {
    vi.spyOn(env.WORKER_JOB, "create").mockRejectedValueOnce(new Error("workflow unavailable"));

    await expect(
      db((client) =>
        delegateTicket(env, client, {
          brief: "criar logo",
          companyId: COMPANY_ID,
          delegatorId: CORR_ID,
          workerKind: "designer",
        }),
      ),
    ).rejects.toThrow(/workflow unavailable/v);

    await expect(db((client) => client.ticket.count())).resolves.toBe(0);
  });
});
