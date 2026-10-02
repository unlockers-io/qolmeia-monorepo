import { Card } from "@repo/ui/components/card";
import type { ActionDetail } from "@repo/worker-api/contracts";

import { DecisionForm } from "@/components/decision-form";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";

const OUTWARD_ACTION_TYPES = new Set(["publish_post", "send_collection_message"]);

type ApprovalDecisionProps = { action: ActionDetail; canRequestChanges: boolean };

const ApprovalDecision = ({ action, canRequestChanges }: ApprovalDecisionProps) =>
  action.status === "pending" ? (
    <Card className="gap-3 p-5">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Decisão</h2>
      <DecisionForm
        actionId={action.id}
        allowChanges={canRequestChanges}
        defaultDecision={OUTWARD_ACTION_TYPES.has(action.actionType) ? null : "approved"}
      />
    </Card>
  ) : (
    <Card className="gap-3 p-5">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Decidido</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status final:</span>
        <StatusPill status={action.status} />
      </div>
      {action.decidedAt !== null && (
        <p className="text-sm text-muted-foreground">
          {formatDateTime(action.decidedAt)}
          {action.decidedByName === null ? "" : ` · ${action.decidedByName}`}
        </p>
      )}
      {action.feedback !== null && action.feedback !== "" && (
        <p className="border-t border-border pt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          “{action.feedback}”
        </p>
      )}
    </Card>
  );

export { ApprovalDecision };
