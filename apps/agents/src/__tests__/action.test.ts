import type { DecisionOutcome } from "@repo/worker-api/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { getAction, listPendingActions } from "#/action/action";
import { completeTicket, proposeAction, recordDecision } from "#/action/approval";
import { listActivity } from "#/activity/log";
import type { JsonRecord } from "#/lib/records";
import { loadTicket } from "#/ticket/ticket";

const COMPANY_ID = "co_action_test";
const WORKER_ID = "agent-action-test";
const TICKET_ID = "tkt-action-test";
const SECOND_TICKET_ID = "tkt-action-test-2";

const propose = (proposed: JsonRecord = {}, ticketId = TICKET_ID) =>
  db((client) =>
    proposeAction(client, {
      actionType: "worker_deliverable",
      companyId: COMPANY_ID,
      feedback: null,
      proposed,
      round: 0,
      summary: "review this",
      ticketId,
    }),
  );

const decide = (actionId: string, decision: DecisionOutcome, decidedByUserId = "user-1") =>
  db((client) =>
    recordDecision(client, {
      actionId,
      companyId: COMPANY_ID,
      decidedByUserId,
      decision,
      summary: "approved result",
      ticketId: TICKET_ID,
    }),
  );

const action = (id: string) => db((client) => getAction(client, id));

const pending = () => db((client) => listPendingActions(client, { companyId: COMPANY_ID }));

const ticket = () => db((client) => loadTicket(client, TICKET_ID));

const activityTypes = async () => {
  const entries = await db((client) => listActivity(client, { companyId: COMPANY_ID }));
  return entries.map(({ type }) => type);
};

const pendingIds = async () => {
  const entries = await pending();
  return entries.map(({ id }) => id);
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, name: "Action Test" });
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
  await seedTicket({ agentInstanceId: WORKER_ID, companyId: COMPANY_ID, id: TICKET_ID });
});

describe("proposeAction + getAction", () => {
  it("inserts a pending action; getAction round-trips it", async () => {
    const { id } = await propose({ summary: "let's ship X" });
    const stored = await action(id);
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("pending");
    expect(stored?.policy).toBe("require_approval");
    expect(stored?.proposed.summary).toBe("let's ship X");
  });
});

describe("recordDecision", () => {
  it("executes an approved action and records the decider", async () => {
    const { id } = await propose();
    await decide(id, "approved");
    const after = await action(id);
    expect(after?.status).toBe("executed");
    expect(after?.decidedByUserId).toBe("user-1");
  });

  it("is idempotent — a second decision leaves the row alone", async () => {
    const { id } = await propose();
    await decide(id, "approved");
    await expect(decide(id, "rejected", "user-2")).resolves.toBeUndefined();
    const after = await action(id);
    expect(after?.status).toBe("executed");
    expect(after?.decidedByUserId).toBe("user-1");
    await expect(ticket()).resolves.toMatchObject({ status: "done" });
    await expect(activityTypes()).resolves.not.toContain("ACTION_REJECTED");
  });
});

describe("listPendingActions", () => {
  it("excludes an action once it is executed", async () => {
    const { id } = await propose();
    await decide(id, "approved");
    await expect(action(id)).resolves.toMatchObject({ status: "executed" });
    await expect(pendingIds()).resolves.not.toContain(id);
  });

  it("returns oldest-first within companyId", async () => {
    await seedTicket({ agentInstanceId: WORKER_ID, companyId: COMPANY_ID, id: SECOND_TICKET_ID });
    const first = await propose({ n: 1 });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
    const second = await propose({ n: 2 }, SECOND_TICKET_ID);
    const ids = await pendingIds();
    expect(ids).toContain(first.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  it("is idempotent on (ticketId, pending): double-propose returns the same id, one row", async () => {
    const first = await propose({ attempt: 1 });
    const second = await propose({ attempt: 2 });
    expect(second.id).toBe(first.id);
    const entries = await pending();
    const forTicket = entries.filter((entry) => entry.ticketId === TICKET_ID);
    expect(forTicket).toHaveLength(1);
    expect(forTicket[0]?.id).toBe(first.id);
  });

  it("allows a fresh propose once the prior action is no longer pending", async () => {
    const first = await propose({ attempt: 1 });
    await decide(first.id, "rejected", "op-1");
    const second = await propose({ attempt: 2 });
    expect(second.id).not.toBe(first.id);
  });
});

describe("approval use cases", () => {
  it("proposes an action and moves its ticket in one transaction", async () => {
    const { id } = await propose({ summary: "review this" });
    await expect(action(id)).resolves.toMatchObject({ status: "pending" });
    await expect(ticket()).resolves.toMatchObject({ status: "awaiting_approval" });
    await expect(activityTypes()).resolves.toContain("ACTION_PROPOSED");
  });

  it("applies approval to the action and ticket in one transaction", async () => {
    const { id } = await propose({ summary: "approved result" });
    await decide(id, "approved", "operator-1");
    const stored = await action(id);
    const done = await ticket();
    expect(stored?.status).toBe("executed");
    expect(done?.status).toBe("done");
    expect(done?.result).toEqual({ summary: "approved result" });
  });

  it("completes notify-only work with both activity entries", async () => {
    await db((client) =>
      completeTicket(client, {
        companyId: COMPANY_ID,
        policy: "notify_only",
        summary: "finished",
        ticketId: TICKET_ID,
      }),
    );
    await expect(ticket()).resolves.toMatchObject({ status: "done" });
    await expect(activityTypes()).resolves.toEqual(
      expect.arrayContaining(["ACTION_NOTIFY", "TICKET_DONE"]),
    );
  });
});
