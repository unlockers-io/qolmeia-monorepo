import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { canRequestChanges, MAX_REVISIONS } from "#/action/action";
import { proposeAction, recordDecision } from "#/action/approval";

const COMPANY_ID = "co_revision_cap";
const WORKER_ID = "agent-revision-cap";
const TICKET_ID = "tkt-revision-cap";

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
  await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]);
  await seedTicket({ agentInstanceId: WORKER_ID, companyId: COMPANY_ID, id: TICKET_ID });
});

const proposeRound = async (round: number): Promise<string> => {
  const { id } = await db((client) =>
    proposeAction(client, {
      actionType: "worker_deliverable",
      companyId: COMPANY_ID,
      feedback: round > 0 ? "ajuste" : null,
      policy: "require_approval",
      proposed: {},
      round,
      summary: `round ${round}`,
      ticketId: TICKET_ID,
    }),
  );
  return id;
};

const requestChanges = (actionId: string, round: number) =>
  db((client) =>
    recordDecision(client, {
      actionId,
      companyId: COMPANY_ID,
      decidedByUserId: "operator",
      decision: "changes_requested",
      feedback: "ajuste",
      round,
      ticketId: TICKET_ID,
    }),
  );

const changesAllowed = () => db((client) => canRequestChanges(client, TICKET_ID));

describe("revision cap", () => {
  it("allows change requests until the last revision round, then only approve or reject", async () => {
    for (let round = 0; round < MAX_REVISIONS; round += 1) {
      const id = await proposeRound(round);
      expect(await changesAllowed()).toBe(true);
      await expect(requestChanges(id, round)).resolves.toBe("revise");
    }
    await proposeRound(MAX_REVISIONS);
    expect(await changesAllowed()).toBe(false);
  });

  it("ends the ticket when changes are requested past the cap", async () => {
    const id = await proposeRound(MAX_REVISIONS);
    await expect(requestChanges(id, MAX_REVISIONS)).resolves.toBe("end");
    const ticket = await db((client) =>
      client.ticket.findUniqueOrThrow({ where: { id: TICKET_ID } }),
    );
    expect(ticket.status).toBe("rejected");
  });
});
