import type { ActionTypeModule } from "#/action/action-type";
import { deliverableSchema, readDeliverable, releaseDeliverable } from "#/action/deliverable";

const workerDeliverable: ActionTypeModule = {
  defaultPolicy: "auto_execute",
  async execute(ctx, proposed) {
    const { assetIds, summary } = deliverableSchema.parse(proposed);
    await releaseDeliverable(ctx, assetIds);
    return summary;
  },
  propose: readDeliverable,
};

export { workerDeliverable };
