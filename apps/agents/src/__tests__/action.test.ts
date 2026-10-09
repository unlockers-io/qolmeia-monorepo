import type { ActionPolicy, DecisionOutcome } from "@repo/worker-api/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { actionIdFor, getAction, listPendingActions } from "#/action/action";
import { markExecuted, proposeAction, recordDecision } from "#/action/approval";
import { listActivity } from "#/activity/log";
import type { JsonRecord } from "#/lib/records";
import { loadTicket } from "#/ticket/ticket";

const COMPANY_ID = "co_action_test";
const WORKER_ID = "agent-action-test";
const TICKET_ID = "tkt-action-test";
const SECOND_TICKET_ID = "tkt-action-test-2";

type ProposeInput = {
  policy?: ActionPolicy;
  proposed?: JsonRecord;
  round?: number;
  ticketId?: string;
};

const propose = ({ policy, proposed, round, ticketId }: ProposeInput = {}) =>
  db((client) =>
    proposeAction(client, {
      actionType: "worker_deliverable",
      companyId: COMPANY_ID,
      feedback: null,
      policy: policy ?? "require_approval",
      proposed: proposed ?? {},
      round: round ?? 0,
      summary: "review this",
      ticketId: ticketId ?? TICKET_ID,
    }),
  );

const decide = (actionId: string, decision: DecisionOutcome, decidedByUserId = "user-1") =>
  db((client) =>
    recordDecision(client, {
      actionId,
      companyId: COMPANY_ID,
      decidedByUserId,
      decision,
      round: 0,
      ticketId: TICKET_ID,
    }),
  );

const execute = (actionId: string, policy: ActionPolicy) =>
  db((client) =>
    markExecuted(client, {
      actionId,
      companyId: COMPANY_ID,
      policy,
      result: "approved result",
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
  it("inserts a pending action keyed by ticket and round; getAction round-trips it", async () => {
    const { id } = await propose({ proposed: { summary: "let's ship X" } });
    expect(id).toBe(actionIdFor(TICKET_ID, 0));
    const stored = await action(id);
    expect(stored?.status).toBe("pending");
    expect(stored?.policy).toBe("require_approval");
    expect(stored?.proposed.summary).toBe("let's ship X");
  });

  it("is idempotent per round: a retried propose returns the same id and keeps one row", async () => {
    const first = await propose({ proposed: { attempt: 1 } });
    const second = await propose({ proposed: { attempt: 2 } });
    expect(second.id).toBe(first.id);
    await expect(action(first.id)).resolves.toMatchObject({ proposed: { attempt: 1 } });
    await expect(activityTypes()).resolves.toEqual(["ACTION_PROPOSED"]);
  });

  it("clears an ungated action to execute without moving the ticket", async () => {
    const { id } = await propose({ policy: "auto_execute" });
    await expect(action(id)).resolves.toMatchObject({ policy: "auto_execute", status: "approved" });
    await expect(ticket()).resolves.toMatchObject({ status: "in_progress" });
    await expect(activityTypes()).resolves.toEqual([]);
  });
});

describe("recordDecision", () => {
  it("approves the action and records the decider", async () => {
    const { id } = await propose();
    await expect(decide(id, "approved")).resolves.toBe("execute");
    const after = await action(id);
    expect(after?.status).toBe("approved");
    expect(after?.decidedByUserId).toBe("user-1");
    await expect(activityTypes()).resolves.toContain("ACTION_APPROVED");
  });

  it("is idempotent — a second decision leaves the row alone", async () => {
    const { id } = await propose();
    await decide(id, "approved");
    await decide(id, "rejected", "user-2");
    const after = await action(id);
    expect(after?.status).toBe("approved");
    expect(after?.decidedByUserId).toBe("user-1");
    await expect(activityTypes()).resolves.not.toContain("ACTION_REJECTED");
  });

  it("ends the ticket on reject", async () => {
    const { id } = await propose();
    await expect(decide(id, "rejected")).resolves.toBe("end");
    await expect(ticket()).resolves.toMatchObject({ status: "rejected" });
  });
});

describe("markExecuted", () => {
  it("executes an approved action and completes its ticket with the result", async () => {
    const { id } = await propose();
    await decide(id, "approved", "operator-1");
    await execute(id, "require_approval");
    await expect(action(id)).resolves.toMatchObject({ status: "executed" });
    const done = await ticket();
    expect(done?.status).toBe("done");
    expect(done?.result).toEqual({ summary: "approved result" });
    await expect(activityTypes()).resolves.toContain("ACTION_EXECUTED");
  });

  it("is idempotent — a retried execute writes one activity entry", async () => {
    const { id } = await propose({ policy: "notify_only" });
    await execute(id, "notify_only");
    await execute(id, "notify_only");
    await expect(activityTypes()).resolves.toEqual(["ACTION_NOTIFY"]);
  });

  it("refuses to execute an action still waiting on its Decision", async () => {
    const { id } = await propose();
    await execute(id, "require_approval");
    await expect(action(id)).resolves.toMatchObject({ status: "pending" });
    await expect(ticket()).resolves.toMatchObject({ status: "awaiting_approval" });
  });
});

describe("listPendingActions", () => {
  it("excludes an action once it is decided", async () => {
    const { id } = await propose();
    await decide(id, "approved");
    await expect(pendingIds()).resolves.not.toContain(id);
  });

  it("returns oldest-first within companyId", async () => {
    await seedTicket({ agentInstanceId: WORKER_ID, companyId: COMPANY_ID, id: SECOND_TICKET_ID });
    const first = await propose({ proposed: { n: 1 } });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
    const second = await propose({ proposed: { n: 2 }, ticketId: SECOND_TICKET_ID });
    const ids = await pendingIds();
    expect(ids).toContain(first.id);
    expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id));
  });

  it("lists a revision round as a fresh pending action", async () => {
    const first = await propose();
    await decide(first.id, "changes_requested");
    const second = await propose({ round: 1 });
    expect(second.id).toBe(actionIdFor(TICKET_ID, 1));
    await expect(pendingIds()).resolves.toEqual([second.id]);
  });
});
