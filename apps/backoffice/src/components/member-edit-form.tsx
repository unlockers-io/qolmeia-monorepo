"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { StatusPill, type StatusTone } from "@repo/ui/compositions/status-pill";
import { agentAvatarClass, agentInitials, agentRoleLabel } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type { TeamMemberDetailView } from "@repo/worker-api/contracts";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { PromptEditor } from "@/components/prompt-editor";
import { apiSend, describeRequestError } from "@/lib/api-client";

type MemberEditFormProps = {
  companyId: string;
  initialMember: TeamMemberDetailView;
  memberId: string;
};

const STATUS_LABEL = {
  available: "Disponível",
  awaiting_approval: "Aguardando aprovação",
  paused: "Pausado",
  working: "Trabalhando",
} satisfies Record<TeamMemberDetailView["status"], string>;

const STATUS_TONE = {
  available: "success",
  awaiting_approval: "warning",
  paused: "neutral",
  working: "info",
} satisfies Record<TeamMemberDetailView["status"], StatusTone>;

const applyStatus = (
  member: TeamMemberDetailView,
  status: TeamMemberDetailView["status"],
): TeamMemberDetailView => ({ ...member, status });

const MemberEditForm = ({ companyId, initialMember, memberId }: MemberEditFormProps) => {
  const [member, setMember] = useState(initialMember);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isTogglingPause, startPauseToggle] = useTransition();
  const [optimisticMember, applyOptimisticStatus] = useOptimistic(member, applyStatus);

  const name = nameDraft ?? member.displayName;

  const patch = async (body: {
    displayName?: string;
    promptOverride?: string | null;
    status?: "active" | "paused";
  }) => {
    setBusy(true);
    try {
      const data = await apiSend<{ member: TeamMemberDetailView }>(
        "PATCH",
        `/teams/${companyId}/members/${memberId}`,
        body,
      );
      setMember(data.member);
    } catch (error) {
      setBusy(false);
      throw error;
    }
    setBusy(false);
  };

  const handleSaveName = async () => {
    try {
      await patch({ displayName: name });
      setNameDraft(null);
      toast.success("Nome atualizado.");
    } catch (error) {
      toast.error(describeRequestError(error, "Não foi possível salvar. Tente de novo."));
    }
  };

  const handleSavePrompt = async (value: string) => {
    try {
      await patch({ promptOverride: value });
      toast.success("Prompt atualizado.");
    } catch (error) {
      toast.error(describeRequestError(error, "Não foi possível salvar. Tente de novo."));
    }
  };

  const handleResetPrompt = async () => {
    try {
      await patch({ promptOverride: null });
      toast.success("Prompt restaurado.");
    } catch (error) {
      toast.error(describeRequestError(error, "Não foi possível salvar. Tente de novo."));
    }
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
              label={STATUS_LABEL[optimisticMember.status]}
              pulse={optimisticMember.status === "working"}
              tone={STATUS_TONE[optimisticMember.status]}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {member.companyName} · {agentRoleLabel(member.role, member.templateName)}
          </p>
        </div>
        {member.role === "worker" ? (
          <Button disabled={busy || isTogglingPause} onClick={handleTogglePause} variant="outline">
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
          <Field>
            <FieldLabel htmlFor="member-name">Nome de exibição</FieldLabel>
            <div className="flex gap-2">
              <Input
                disabled={busy}
                id="member-name"
                onChange={(e) => {
                  setNameDraft(e.target.value);
                }}
                value={name}
              />
              <Button
                disabled={busy || name === member.displayName}
                onClick={() => {
                  void handleSaveName();
                }}
                variant="outline"
              >
                Renomear
              </Button>
            </div>
          </Field>

          <PromptEditor
            busy={busy}
            initialValue={member.promptOverride}
            onReset={handleResetPrompt}
            onSave={handleSavePrompt}
            templatePrompt={member.templateSystemPrompt}
            updatedAt={member.promptOverrideUpdatedAt}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export { MemberEditForm };
