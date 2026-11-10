import type { StatusTone } from "@repo/ui/compositions/status-pill";
import type { AgentDisplayStatus } from "@repo/worker-api/contracts";

const AGENT_STATUS = {
  available: { label: "Disponível", pulse: false, tone: "success" },
  awaiting_approval: { label: "Aguardando aprovação", pulse: false, tone: "warning" },
  paused: { label: "Pausado", pulse: false, tone: "neutral" },
  working: { label: "Trabalhando", pulse: true, tone: "info" },
} satisfies Record<AgentDisplayStatus, { label: string; pulse: boolean; tone: StatusTone }>;

export { AGENT_STATUS };
