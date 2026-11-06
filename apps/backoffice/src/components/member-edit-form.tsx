"use client";

import { agentAvatarClass, agentInitials, agentRoleLabel } from "@repo/app-shell/agent-avatar";
import { AGENT_STATUS } from "@repo/app-shell/agent-status";
import { PromptEditor } from "@repo/app-shell/prompt-editor";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { cn } from "@repo/ui/lib/utils";
import { describeRequestError } from "@repo/worker-api";
import type { operatorMemberPatchSchema, TeamMemberDetailView } from "@repo/worker-api/contracts";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import type { z } from "zod";

import { MemberNameForm } from "@/components/member-name-form";
import { patchMember } from "@/lib/backoffice-api";

type MemberEditFormProps = {
  companyId: string;
  initialMember: TeamMemberDetailView;
  memberId: string;
};

const applyStatus = (
  member: TeamMemberDetailView,
  status: TeamMemberDetailView["status"],
): TeamMemberDetailView => ({ ...member, status });

const MemberEditForm = ({ companyId, initialMember, memberId }: MemberEditFormProps) => {
  const [member, setMember] = useState(initialMember);
  const [busy, setBusy] = useState(false);
  const [isTogglingPause, startPauseToggle] = useTransition();
  const [optimisticMember, applyOptimisticStatus] = useOptimistic(member, applyStatus);
  const ready = useClientReady();
  const disabled = !ready || busy;

  const patch = async (body: z.input<typeof operatorMemberPatchSchema>) => {
    setBusy(true);

    try {
      const data = await patchMember(companyId, memberId, body);

      setMember(data.member);
    } catch (error) {
      setBusy(false);
      throw error;
    }

    setBusy(false);
  };

  const handleRename = async (displayName: string) => {
    await patch({ displayName });
    toast.success("Nome atualizado.");
  };

  const handleSavePrompt = async (promptOverride: string | null) => {
    await patch({ promptOverride });
    toast.success(promptOverride === null ? "Prompt restaurado." : "Prompt atualizado.");
  };

  const handleTogglePause = () => {
    const next = member.status === "paused" ? "active" : "paused";
    startPauseToggle(async () => {
      applyOptimisticStatus(next === "paused" ? "paused" : "available");

      try {
        await patch({ status: next });
        toast.success(next === "paused" ? "Agente pausado." : "Agente retomado.");
      } catch (error) {
        toast.error(describeRequestError(error, "Não foi possível salvar. Tente de novo."));
      }
    });
  };

  const memberSince = new Date(member.createdAt).toLocaleDateString("pt-BR", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-member-card font-display text-xl font-bold text-white",
            agentAvatarClass(member.role, member.workerKind),
          )}
        >
          {agentInitials(member.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {member.displayName}
            </h1>
            <StatusPill
              label={AGENT_STATUS[optimisticMember.status].label}
              pulse={AGENT_STATUS[optimisticMember.status].pulse}
              tone={AGENT_STATUS[optimisticMember.status].tone}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {member.companyName} · {agentRoleLabel(member.role, member.templateName)}
          </p>
        </div>
        {member.role === "worker" ? (
          <Button
            disabled={disabled || isTogglingPause}
            onClick={handleTogglePause}
            variant="outline"
          >
            {optimisticMember.status === "paused" ? "Retomar" : "Pausar"}
          </Button>
        ) : null}
      </header>

      <Card>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Entregas</dt>
              <dd className="mt-1 text-base font-semibold text-foreground tabular-nums">
                {member.lifetimeDone}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Em andamento</dt>
              <dd className="mt-1 text-base font-semibold text-foreground tabular-nums">
                {member.currentWork.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">No time desde</dt>
              <dd className="mt-1 text-base font-semibold text-foreground">{memberSince}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <MemberNameForm busy={busy} displayName={member.displayName} onRename={handleRename} />

          {member.role === "worker" ? (
            <div className="flex flex-col gap-3">
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Padrão do template
                </summary>
                <pre className="mt-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                  {member.templateSystemPrompt}
                </pre>
              </details>
              <PromptEditor
                busy={busy}
                initialValue={member.promptOverride}
                label="Prompt do agente"
                onSave={handleSavePrompt}
                placeholder="Escreva instruções específicas para este agente, em pt-BR."
                updatedAt={member.promptOverrideUpdatedAt}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export { MemberEditForm };
