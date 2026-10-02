"use client";

import { StatusPill, type StatusTone } from "@repo/ui/compositions/status-pill";
import { agentAvatarClass, agentInitials, agentRoleLabel } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import { Pencil } from "lucide-react";

import { STATUS_LABEL, type AgentDisplayStatus, type TeamMemberView } from "@/lib/team";

type Variant = "compact" | "detailed";

type AgentCardProps = {
  member: TeamMemberView;
  variant: Variant;
};

const deliveriesLabel = (count: number): string =>
  `${count} ${count === 1 ? "entrega" : "entregas"}`;

const STATUS_TONE = {
  available: "success",
  awaiting_approval: "warning",
  paused: "neutral",
  working: "info",
} satisfies Record<AgentDisplayStatus, StatusTone>;

const AgentCard = ({ member, variant }: AgentCardProps) => {
  const currentWork = member.currentWork.at(0);
  const detailed = variant === "detailed";
  const tone = STATUS_TONE[member.status];
  const deliveries = member.role === "worker" ? deliveriesLabel(member.lifetimeDone) : null;
  const statusPill = (
    <StatusPill
      className="shrink-0"
      label={STATUS_LABEL[member.status]}
      pulse={member.status === "working"}
      tone={tone}
    />
  );
  return (
    <article className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-panel font-display font-bold text-white",
          agentAvatarClass(member.role, member.workerKind),
          detailed ? "size-11 text-base" : "size-10 text-sm",
        )}
      >
        {agentInitials(member.displayName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold">{member.displayName}</h3>
          {member.hasPromptOverride && (
            <Pencil aria-label="Prompt personalizado" className="size-3 text-muted-foreground" />
          )}
        </div>
        {detailed ? (
          <p className="text-xs text-muted-foreground">
            {deliveries === null
              ? agentRoleLabel(member.role, member.templateName)
              : `${agentRoleLabel(member.role, member.templateName)} · ${deliveries}`}
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {statusPill}
            {deliveries !== null && (
              <span className="text-xs text-muted-foreground">{deliveries}</span>
            )}
          </div>
        )}
        {detailed && currentWork !== undefined && (
          <p className="mt-1 truncate text-xs text-muted-foreground">→ {currentWork.summary}</p>
        )}
      </div>
      {detailed && statusPill}
    </article>
  );
};

export { AgentCard };
export type { AgentCardProps };
