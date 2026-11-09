import type { ActionPolicy, ActionType, Template } from "@repo/worker-api/contracts";

import type { ActionTypeModule } from "#/action/action-type";
import { publishPost } from "#/action/publish-post";
import { workerDeliverable } from "#/action/worker-deliverable";

type ActionTypeModules = { [Type in ActionType]: ActionTypeModule<Type> };

const ACTION_TYPE_MODULES: ActionTypeModules = {
  publish_post: publishPost,
  worker_deliverable: workerDeliverable,
};

/** An Action type absent from the Template's `defaultPolicies` takes the type's own default. */
const resolvePolicy = (
  actionType: ActionType,
  template: Pick<Template, "defaultPolicies">,
): ActionPolicy =>
  template.defaultPolicies[actionType] ?? ACTION_TYPE_MODULES[actionType].defaultPolicy;

export { ACTION_TYPE_MODULES, resolvePolicy };
