import { Skeleton } from "@repo/ui/components/skeleton";
import type {
  Action,
  ActionDetailResponse,
  ActionStatus,
  TicketDetailResponse,
} from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createElement, Suspense } from "react";

import { ACTION_RENDERERS } from "@/components/action-renderers";
import { BackLink } from "@/components/back-link";
import { StatusPill } from "@/components/status-pill";
import { ApiError } from "@/lib/api-client";
import { apiGetServer } from "@/lib/api-server";
import { actionTypeLabel, formatRelative } from "@/lib/format";

import { ApprovalContext } from "./approval-context";
import { ApprovalDecision } from "./approval-decision";
import { PreviousRound } from "./previous-round";

export const metadata: Metadata = { title: "Revisar aprovação" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type ApprovalDetailPageProps = {
  params: Promise<{ id: string }>;
};

const POLICY_COPY = {
  auto_execute: "Execução automática",
  notify_only: "Apenas notificar",
  require_approval: "Sob aprovação",
} satisfies Record<string, string>;

const TITLE = {
  approved: "Ação aprovada",
  changes_requested: "Ajustes pedidos",
  executed: "Ação executada",
  pending: "Revisar ação",
  rejected: "Ação rejeitada",
} satisfies Record<ActionStatus, string>;

const loadTicketActions = async (ticketId: string): Promise<ReadonlyArray<Action>> => {
  try {
    const detail = await apiGetServer<TicketDetailResponse>(`/tickets/${ticketId}`);
    return detail.actions;
  } catch {
    return [];
  }
};

const ApprovalDetailContent = async ({ params }: ApprovalDetailPageProps) => {
  const { id } = await params;

  let detail: ActionDetailResponse | null = null;
  try {
    detail = await apiGetServer<ActionDetailResponse>(`/actions/${id}`);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }
  if (!detail) {
    notFound();
  }

  const { action, ageSeconds, canRequestChanges, ticket } = detail;
  const policyCopy = POLICY_COPY[action.policy];
  const rounds = ticket === null ? [] : await loadTicketActions(ticket.id);
  const roundIndex = rounds.findIndex((round) => round.id === action.id);
  const previousRound = roundIndex > 0 ? rounds[roundIndex - 1] : undefined;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-(length:--text-heading)">
              {TITLE[action.status]}
            </h1>
            <span className="font-mono text-xs text-muted-foreground">{action.id}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {actionTypeLabel(action.actionType)}
            </span>
            {rounds.length > 1 && roundIndex !== -1 ? ` · Rodada ${roundIndex + 1}` : ""} ·{" "}
            {policyCopy} · {formatRelative(action.createdAt)}
          </p>
        </div>
        <StatusPill status={action.status} />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-approval">
        <div className="flex flex-col gap-4">
          <PreviousRound round={previousRound} roundIndex={roundIndex} />
          {createElement(ACTION_RENDERERS[action.actionType], {
            agent: action.agent,
            proposed: action.proposed,
          })}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <ApprovalDecision action={action} canRequestChanges={canRequestChanges} />

          <ApprovalContext
            action={action}
            ageSeconds={ageSeconds}
            policyCopy={policyCopy}
            ticket={ticket}
          />
        </div>
      </div>
    </div>
  );
};

const ApprovalDetailSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-5">
    <Skeleton className="h-8 w-72" />
    <Skeleton className="h-48 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
);

const ApprovalDetailPage = (props: ApprovalDetailPageProps) => (
  <div className="flex flex-col gap-5">
    <BackLink href="/approvals">Aprovações</BackLink>
    <Suspense fallback={<ApprovalDetailSkeleton />}>
      <ApprovalDetailContent {...props} />
    </Suspense>
  </div>
);

export default ApprovalDetailPage;
