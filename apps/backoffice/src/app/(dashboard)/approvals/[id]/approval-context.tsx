import { Card } from "@repo/ui/components/card";
import { agentAvatarClass, agentInitials } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type { ActionDetailResponse } from "@repo/worker-api/contracts";
import Link from "next/link";

import { formatDateTime, formatDurationSeconds } from "@/lib/format";

const ContextRow = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="flex min-w-0 items-center gap-2 font-medium text-foreground">{children}</dd>
  </div>
);

type ApprovalContextProps = Pick<ActionDetailResponse, "action" | "ageSeconds" | "ticket"> & {
  policyCopy: string | undefined;
};

const ApprovalContext = ({ action, ageSeconds, policyCopy, ticket }: ApprovalContextProps) => (
  <Card className="gap-3 p-5">
    <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Contexto</h2>
    <dl className="flex flex-col gap-2.5 text-sm">
      <ContextRow label="Empresa">
        <span className="truncate">{action.companyName}</span>
      </ContextRow>
      <ContextRow label="Agente">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 flex-none items-center justify-center rounded-lg text-xs font-bold text-white",
            agentAvatarClass(action.agent.role, action.agent.workerKind),
          )}
        >
          {agentInitials(action.agent.name)}
        </span>
        <span className="truncate">{action.agent.name}</span>
      </ContextRow>
      {ticket && (
        <ContextRow label="Ticket">
          <Link
            className="truncate rounded-sm font-mono text-xs text-primary transition-colors outline-none hover:text-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
            href={`/tickets/${ticket.id}`}
          >
            {ticket.id}
          </Link>
        </ContextRow>
      )}
      {action.status === "pending" ? (
        <ContextRow label="Aguardando">{formatDurationSeconds(Math.max(0, ageSeconds))}</ContextRow>
      ) : null}
      <ContextRow label="Política">{policyCopy}</ContextRow>
      <ContextRow label="Criado">{formatDateTime(action.createdAt)}</ContextRow>
    </dl>
    {ticket && (
      <p className="border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">
        {ticket.brief}
      </p>
    )}
  </Card>
);

export { ApprovalContext };
