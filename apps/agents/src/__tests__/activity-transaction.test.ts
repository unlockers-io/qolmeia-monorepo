import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { getAction } from "#/action/action";
import { completeTicket, proposeAction, recordDecision } from "#/action/approval";
import { listActivity } from "#/activity/log";
import { loadTicket } from "#/ticket/ticket";

const COMPANY_ID = "co_activity_tx";
const UNKNOWN_COMPANY_ID = "co_activity_tx_unknown";
const TICKET_ID = "tkt-activity-tx";
const WORKER_ID = "agent-activity-tx";
const ACTIVITY_FOREIGN_KEY = /activity_log_company_id_fkey|Foreign key constraint/v;

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
  await seedTicket({ agentInstanceId: WORKER_ID, companyId: COMPANY_ID, id: TICKET_ID });
});

describe("a failed activity write inside a use-case transaction", () => {
  it("fails notify-only completion and keeps the ticket unchanged", async () => {
    await expect(
      db((client) =>
        completeTicket(client, {
          companyId: UNKNOWN_COMPANY_ID,
          policy: "notify_only",
          summary: "finished",
          ticketId: TICKET_ID,
        }),
      ),
    ).rejects.toThrow(ACTIVITY_FOREIGN_KEY);

    const ticket = await db((client) => loadTicket(client, TICKET_ID));
    expect(ticket?.status).toBe("in_progress");
    expect(ticket?.result).toBeNull();
  });

  it("fails the approval and leaves the action pending", async () => {
    const action = await db((client) =>
      proposeAction(client, {
        actionType: "worker_deliverable",
        companyId: COMPANY_ID,
        feedback: null,
        proposed: { summary: "review this" },
        round: 0,
        summary: "review this",
        ticketId: TICKET_ID,
      }),
    );

    await expect(
      db((client) =>
        recordDecision(client, {
          actionId: action.id,
          companyId: UNKNOWN_COMPANY_ID,
          decidedByUserId: "operator-1",
          decision: "approved",
          summary: "approved result",
          ticketId: TICKET_ID,
        }),
      ),
    ).rejects.toThrow(ACTIVITY_FOREIGN_KEY);

    const [storedAction, ticket, activity] = await db((client) =>
      Promise.all([
        getAction(client, action.id),
        loadTicket(client, TICKET_ID),
        listActivity(client, { companyId: COMPANY_ID }),
      ]),
    );
    expect(storedAction?.status).toBe("pending");
    expect(storedAction?.decidedByUserId).toBeNull();
    expect(ticket?.status).toBe("awaiting_approval");
    expect(activity.map((entry) => entry.type)).toEqual(["ACTION_PROPOSED"]);
  });
});
