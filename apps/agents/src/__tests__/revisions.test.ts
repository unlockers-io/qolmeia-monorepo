import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { decideAction, proposeAction } from "#/db/action";
import { canRequestChanges, MAX_REVISIONS } from "#/lib/revisions";

const COMPANY_ID = "co_revision_cap";
const TICKET_ID = "tkt-revision-cap";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM action WHERE ticket_id = ?`).bind(TICKET_ID),
    env.DB.prepare(
      `INSERT OR IGNORE INTO company
         (id, name, slug, timezone, locale, status, brief, created_at, updated_at)
       VALUES (?, 'Revision Cap', 'revision-cap', 'America/Sao_Paulo', 'pt-BR', 'active', NULL, 0, 0)`,
    ).bind(COMPANY_ID),
    env.DB.prepare(
      `INSERT OR IGNORE INTO agent_instance
         (id, company_id, role, template_id, template_version, display_name,
          model_override, status, created_at, updated_at)
       VALUES ('agent-revision-cap', ?, 'worker', 'tpl-designer', 1, 'd', NULL, 'active', 0, 0)`,
    ).bind(COMPANY_ID),
    env.DB.prepare(
      `INSERT OR IGNORE INTO ticket
         (id, company_id, agent_instance_id, parent_ticket_id, title, brief,
          status, origin, workflow_id, result, created_at, updated_at)
       VALUES (?, ?, 'agent-revision-cap', NULL, 't', 'b',
               'open', 'delegation', NULL, NULL, 0, 0)`,
    ).bind(TICKET_ID, COMPANY_ID),
  ]);
});

const proposeRound = async (): Promise<string> => {
  const { id } = await proposeAction(env.DB, {
    actionType: "worker_deliverable",
    companyId: COMPANY_ID,
    policy: "require_approval",
    proposed: {},
    ticketId: TICKET_ID,
  });
  return id;
};

describe("canRequestChanges", () => {
  it("allows change requests until the last revision round, then only approve or reject", async () => {
    for (let round = 0; round < MAX_REVISIONS; round += 1) {
      const id = await proposeRound();
      expect(await canRequestChanges(env.DB, TICKET_ID)).toBe(true);
      await decideAction(env.DB, {
        actionId: id,
        decidedByUserId: "operator",
        decision: "changes_requested",
      });
    }
    await proposeRound();
    expect(await canRequestChanges(env.DB, TICKET_ID)).toBe(false);
  });
});
