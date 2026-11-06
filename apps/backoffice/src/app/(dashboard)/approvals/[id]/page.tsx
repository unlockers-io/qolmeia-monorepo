import { apiGetServer } from "@repo/app-shell/server-api";
import { Skeleton } from "@repo/ui/components/skeleton";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import type { ActionPolicy, ActionStatus } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ACTION_TYPE_VIEWS, ActionCard } from "@/components/action-types";
import { BackLink } from "@/components/back-link";
import { getAction } from "@/lib/backoffice-api";
import { formatRelative } from "@/lib/format";
import { orNotFound } from "@/lib/or-not-found";
import { ACTION_STATUS } from "@/lib/status";

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
} satisfies Record<ActionPolicy, string>;

const TITLE = {
  approved: "Ação aprovada",
  changes_requested: "Ajustes pedidos",
  executed: "Ação executada",
  pending: "Revisar ação",
  rejected: "Ação rejeitada",
} satisfies Record<ActionStatus, string>;

const ApprovalDetailContent = async ({ params }: ApprovalDetailPageProps) => {
  const { id } = await params;

  const { action, ageSeconds, canRequestChanges, rounds, ticket } = await orNotFound(
    getAction(apiGetServer, id),
  );

  const policyCopy = POLICY_COPY[action.policy];
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
              {ACTION_TYPE_VIEWS[action.actionType].label}
            </span>
            {rounds.length > 1 ? ` · Rodada ${roundIndex + 1}` : ""} · {policyCopy} ·{" "}
            {formatRelative(action.createdAt)}
          </p>
        </div>
        <StatusPill {...ACTION_STATUS[action.status]} />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-approval">
        <div className="flex flex-col gap-4">
          <PreviousRound round={previousRound} roundIndex={roundIndex} />
          <ActionCard action={action} />
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
