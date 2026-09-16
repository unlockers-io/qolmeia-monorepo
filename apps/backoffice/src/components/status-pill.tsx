import { StatusPill as SharedStatusPill } from "@repo/ui/compositions/status-pill";
import type { ActionStatus, TicketStatus } from "@repo/worker-api/contracts";

type StatusKind = ActionStatus | TicketStatus;

type Tone = "success" | "warning" | "info" | "danger" | "neutral";

const STATUS_COPY = {
  approved: "Aprovado",
  awaiting_approval: "Aguardando aprovação",
  blocked: "Bloqueado",
  cancelled: "Cancelado",
  changes_requested: "Mudanças pedidas",
  done: "Concluído",
  executed: "Executado",
  in_progress: "Em andamento",
  open: "Aberto",
  pending: "Pendente",
  rejected: "Rejeitado",
} satisfies Record<StatusKind, string>;

const STATUS_TONE = {
  approved: "success",
  awaiting_approval: "warning",
  blocked: "danger",
  cancelled: "neutral",
  changes_requested: "warning",
  done: "success",
  executed: "success",
  in_progress: "info",
  open: "info",
  pending: "warning",
  rejected: "danger",
} satisfies Record<StatusKind, Tone>;

type StatusPillProps = {
  className?: string;
  status: StatusKind;
};

const StatusPill = ({ className, status }: StatusPillProps) => (
  <SharedStatusPill className={className} label={STATUS_COPY[status]} tone={STATUS_TONE[status]} />
);

export { StatusPill };
