const ACTION_TYPES = ["publish_post", "worker_deliverable"] as const;

type ActionType = (typeof ACTION_TYPES)[number];

export { ACTION_TYPES };
export type { ActionType };
