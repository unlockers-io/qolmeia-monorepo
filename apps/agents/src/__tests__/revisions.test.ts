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
      proposed: {},
      round,
      summary: `round ${round}`,
      ticketId: TICKET_ID,
    }),
  );
  return id;
};

const changesAllowed = () => db((client) => canRequestChanges(client, TICKET_ID));

describe("canRequestChanges", () => {
  it("allows change requests until the last revision round, then only approve or reject", async () => {
    for (let round = 0; round < MAX_REVISIONS; round += 1) {
      const id = await proposeRound(round);
      expect(await changesAllowed()).toBe(true);
      await db((client) =>
        recordDecision(client, {
          actionId: id,
          companyId: COMPANY_ID,
          decidedByUserId: "operator",
          decision: "changes_requested",
          feedback: "ajuste",
          summary: `round ${round}`,
          ticketId: TICKET_ID,
        }),
      );
    }
    await proposeRound(MAX_REVISIONS);
    expect(await changesAllowed()).toBe(false);
  });
});
