import type { Action } from "@repo/worker-api/contracts";

const proposalSummary = (proposed: Action["proposed"]): string | null =>
  typeof proposed.summary === "string" && proposed.summary !== "" ? proposed.summary : null;

export { proposalSummary };
