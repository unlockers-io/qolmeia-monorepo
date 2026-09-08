import { Card } from "@repo/ui/components/card";
import type { ActionDetailResponse } from "@repo/worker-api/contracts";

import { DecisionForm } from "@/components/decision-form";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";

const ApprovalDecision = ({ action }: { action: ActionDetailResponse["action"] }) =>
  action.status === "pending" ? (
    <Card className="gap-3 p-5">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Decisão
      </span>
      <DecisionForm actionId={action.id} />
    </Card>
  ) : (
    <Card className="gap-3 p-5">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Decidido
      </span>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status final:</span>
        <StatusPill status={action.status} />
      </div>
      {action.decidedAt !== null && (
        <p className="text-xs text-muted-foreground">
          Decisão em {formatDateTime(action.decidedAt)}
          {action.decidedByUserId !== null && action.decidedByUserId !== ""
            ? ` por ${action.decidedByUserId}`
            : ""}
        </p>
      )}
      {action.feedback !== null && action.feedback !== "" && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {action.feedback}
        </div>
      )}
    </Card>
  );

export { ApprovalDecision };
