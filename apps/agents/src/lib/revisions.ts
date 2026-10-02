import { listActionsForTicket } from "#/db/action";
import type { Database } from "#/db/client";

const MAX_REVISIONS = 3;

const canRequestChanges = async (db: Database, ticketId: string): Promise<boolean> => {
  const rounds = await listActionsForTicket(db, ticketId);
  return rounds.length <= MAX_REVISIONS;
};

export { canRequestChanges, MAX_REVISIONS };
