import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { listActivity } from "#/activity/log";
import { getAction } from "#/db/action";
import { loadTicket } from "#/db/ticket";

const COMPANY_ID = "co_activity_tx";
const UNKNOWN_COMPANY_ID = "co_activity_tx_unknown";
const TICKET_ID = "tkt-activity-tx";
const ACTIVITY_FOREIGN_KEY = /activity_log_company_id_fkey/;

beforeEach(async () => {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO company
       (id, name, slug, timezone, locale, status, brief, created_at, updated_at)
     VALUES (?, 'Activity Tx', 'activity-tx', 'America/Sao_Paulo', 'pt-BR', 'active', NULL, 0, 0)`,
  )
    .bind(COMPANY_ID)
    .run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO agent_instance
       (id, company_id, role, template_id, template_version, display_name,
        model_override, status, created_at, updated_at)
     VALUES ('agent-activity-tx', ?, 'worker', 'tpl-designer', 1, 'd', NULL, 'active', 0, 0)`,
  )
    .bind(COMPANY_ID)
    .run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO ticket
       (id, company_id, agent_instance_id, parent_ticket_id, title, brief,
        status, origin, workflow_id, result, created_at, updated_at)
     VALUES (?, ?, 'agent-activity-tx', NULL, 't', 'b',
             'in_progress', 'delegation', NULL, NULL, 0, 0)`,
  )
    .bind(TICKET_ID, COMPANY_ID)
    .run();
});

describe("a failed activity write inside a use-case transaction", () => {
  it("fails the ticket transition and keeps the ticket unchanged", async () => {
    await expect(
      env.DB("tickets.transition", {
        activity: {
          companyId: UNKNOWN_COMPANY_ID,
          refId: TICKET_ID,
          refType: "ticket",
          summary: "Ticket bloqueado.",
          type: "TICKET_BLOCKED",
        },
        status: "blocked",
        ticketId: TICKET_ID,
      }),
    ).rejects.toThrow(ACTIVITY_FOREIGN_KEY);

    const ticket = await loadTicket(env.DB, TICKET_ID);
    expect(ticket?.status).toBe("in_progress");
  });

  it("fails notify-only completion and keeps the ticket unchanged", async () => {
    await expect(
      env.DB("workflows.complete", {
        companyId: UNKNOWN_COMPANY_ID,
        policy: "notify_only",
        summary: "finished",
        ticketId: TICKET_ID,
      }),
    ).rejects.toThrow(ACTIVITY_FOREIGN_KEY);

    const ticket = await loadTicket(env.DB, TICKET_ID);
    expect(ticket?.status).toBe("in_progress");
    expect(ticket?.result).toBeNull();
  });

  it("fails the approval and leaves the action pending", async () => {
    const action = await env.DB("workflows.propose", {
      actionType: "worker_deliverable",
      companyId: COMPANY_ID,
      feedback: null,
      policy: "require_approval",
      proposed: { summary: "review this" },
      round: 0,
      summary: "review this",
      ticketId: TICKET_ID,
    });

    await expect(
      env.DB("workflows.applyDecision", {
        actionId: action.id,
        companyId: UNKNOWN_COMPANY_ID,
        decidedByUserId: "operator-1",
        decision: "approved",
        summary: "approved result",
        ticketId: TICKET_ID,
      }),
    ).rejects.toThrow(ACTIVITY_FOREIGN_KEY);

    const storedAction = await getAction(env.DB, action.id);
    const ticket = await loadTicket(env.DB, TICKET_ID);
    const activity = await listActivity(env.DB, { companyId: COMPANY_ID });
    expect(storedAction?.status).toBe("pending");
    expect(storedAction?.decidedByUserId).toBeNull();
    expect(ticket?.status).toBe("awaiting_approval");
    expect(activity.map((entry) => entry.type)).toEqual(["ACTION_PROPOSED"]);
  });
});
