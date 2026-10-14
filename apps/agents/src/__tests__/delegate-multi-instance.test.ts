import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { delegateToWorkerSkill } from "#/skills/delegate-to-worker";
import type { SkillContext } from "#/skills/registry";

const COMPANY_ID = "co_multi_test";
const CORR_ID = `corr-${COMPANY_ID}`;
const DESIGNER_1 = "wkr_multi_1";
const DESIGNER_2 = "wkr_multi_2";

beforeEach(async () => {
  vi.spyOn(env.WORKER_JOB, "create").mockResolvedValue({ id: "stub" } as WorkflowInstance);
  await seedCompany({ id: COMPANY_ID });
  await seedTeam(COMPANY_ID, [
    { displayName: "Designer 1", id: DESIGNER_1 },
    { displayName: "Designer 2", id: DESIGNER_2 },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ctx: SkillContext = {
  agentInstanceId: CORR_ID,
  companyId: COMPANY_ID,
  get env() {
    return env;
  },
};

const delegate = async () =>
  (await delegateToWorkerSkill.execute({ brief: "fazer logo", workerKind: "designer" }, ctx)) as {
    error?: string;
    status?: string;
  };

const assignees = async () => {
  const tickets = await db((client) =>
    client.ticket.findMany({
      select: { agentInstanceId: true },
      where: { brief: "fazer logo", companyId: COMPANY_ID },
    }),
  );
  return tickets.map(({ agentInstanceId }) => agentInstanceId);
};

const pause = (ids: ReadonlyArray<string>) =>
  db((client) =>
    client.agentInstance.updateMany({
      data: { status: "paused" },
      where: { id: { in: [...ids] } },
    }),
  );

describe("delegateToWorker multi-instance dispatch", () => {
  it("prefers an available worker over one that's busy", async () => {
    await seedTicket({ agentInstanceId: DESIGNER_1, companyId: COMPANY_ID, id: "tkt_busy" });

    const result = await delegate();
    expect("status" in result && result.status).toBe("queued");
    const assigned = await assignees();
    expect(assigned).toContain(DESIGNER_2);
    expect(assigned).not.toContain(DESIGNER_1);
    expect(env.WORKER_JOB.create).toHaveBeenCalledWith({
      id: expect.any(String),
      params: { agentInstanceId: DESIGNER_2, companyId: COMPANY_ID, ticketId: expect.any(String) },
    });
  });

  it("skips paused workers entirely", async () => {
    await pause([DESIGNER_2]);
    const result = await delegate();
    expect("status" in result && result.status).toBe("queued");
    const assigned = await assignees();
    expect(assigned).toEqual([DESIGNER_1]);
  });

  it("returns an error when all workers of the kind are paused", async () => {
    await pause([DESIGNER_1, DESIGNER_2]);
    const result = await delegate();
    expect("error" in result).toBe(true);
    await expect(assignees()).resolves.toEqual([]);
    expect(env.WORKER_JOB.create).not.toHaveBeenCalled();
  });
});
