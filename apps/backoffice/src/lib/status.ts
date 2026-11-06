import type { StatusTone } from "@repo/ui/compositions/status-pill";
import type { ActionStatus, TicketStatus } from "@repo/worker-api/contracts";

type StatusPresentation = { label: string; tone: StatusTone };

const ACTION_STATUS = {
  approved: { label: "Aprovado", tone: "success" },
  changes_requested: { label: "Ajustes pedidos", tone: "warning" },
  executed: { label: "Executado", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  rejected: { label: "Rejeitado", tone: "danger" },
} satisfies Record<ActionStatus, StatusPresentation>;

const TICKET_STATUS = {
  awaiting_approval: { label: "Aguardando aprovação", tone: "warning" },
  blocked: { label: "Bloqueado", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "neutral" },
  done: { label: "Concluído", tone: "success" },
  in_progress: { label: "Em andamento", tone: "info" },
  open: { label: "Aberto", tone: "info" },
  rejected: { label: "Rejeitado", tone: "danger" },
} satisfies Record<TicketStatus, StatusPresentation>;

export { ACTION_STATUS, TICKET_STATUS };
