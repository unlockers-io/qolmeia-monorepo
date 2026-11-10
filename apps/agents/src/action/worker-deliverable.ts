import type { Prisma } from "@repo/db/worker";
import { PROPOSED_SCHEMAS, type ProposedOf } from "@repo/worker-api/contracts";

import type { ActionTypeModule } from "#/action/action-type";
import { readDeliverable } from "#/action/deliverable";
import { promoteAssets } from "#/library/assets";

const read = (proposed: Prisma.JsonValue): ProposedOf<"worker_deliverable"> =>
  PROPOSED_SCHEMAS.worker_deliverable.parse(proposed);

const workerDeliverable: ActionTypeModule<"worker_deliverable"> = {
  defaultPolicy: "auto_execute",
  async execute({ companyId, db }, proposed) {
    const { assetIds, summary } = read(proposed);
    await promoteAssets(db, companyId, assetIds);

    return summary;
  },
  propose: readDeliverable,
  read,
};

export { workerDeliverable };
