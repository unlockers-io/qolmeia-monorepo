import { ActionPolicy } from "@repo/db/worker";
import { ACTION_TYPES, type ActionType } from "@repo/worker-api/contracts";
import { z } from "zod";

import type { ActionTypeModule } from "#/action/action-type";
import { publishPost } from "#/action/publish-post";
import { workerDeliverable } from "#/action/worker-deliverable";

const ACTION_TYPE_MODULES = {
  publish_post: publishPost,
  worker_deliverable: workerDeliverable,
} satisfies Record<ActionType, ActionTypeModule>;

const actionTypeSchema = z.enum(ACTION_TYPES);

const actionPolicySchema = z.enum(ActionPolicy);

const defaultPoliciesSchema = z.partialRecord(actionTypeSchema, actionPolicySchema);

/**
 * `defaultPolicies` is operator-edited JSON. An absent entry takes the action
 * type's default; an unrecognised value falls back to the safest policy.
 */
const resolvePolicy = (
  actionType: ActionType,
  template: { defaultPolicies: Record<string, string> },
): ActionPolicy => {
  const raw = template.defaultPolicies[actionType];
  if (raw === undefined) {
    return ACTION_TYPE_MODULES[actionType].defaultPolicy;
  }
  return actionPolicySchema.safeParse(raw).data ?? "require_approval";
};

export { ACTION_TYPE_MODULES, actionTypeSchema, defaultPoliciesSchema, resolvePolicy };
