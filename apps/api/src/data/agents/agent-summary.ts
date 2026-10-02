import type { Prisma } from "@repo/db";
import type { AgentSummary } from "@repo/worker-api/contracts";

const agentSummarySelect = {
  displayName: true,
  role: true,
  template: { select: { workerKind: true } },
} as const satisfies Prisma.AgentInstanceSelect;

type AgentSummaryRecord = Prisma.AgentInstanceGetPayload<{ select: typeof agentSummarySelect }>;

const toAgentSummary = (row: AgentSummaryRecord): AgentSummary => ({
  name: row.displayName,
  role: row.role,
  workerKind: row.template?.workerKind ?? null,
});

export { agentSummarySelect, toAgentSummary };
