import { apiGetServer } from "@repo/app-shell/server-api";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import type { ActionDetailResponse, ActionPolicy, ActionStatus } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SkeletonBox, SkeletonSuspense } from "skullet/react";

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

type ApprovalDetailViewProps = {
  decision: ReactNode;
  detail: ActionDetailResponse;
  now: Date;
};

const ApprovalDetailView = ({ decision, detail, now }: ApprovalDetailViewProps) => {
  const { action, ageSeconds, rounds, ticket } = detail;
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
            {formatRelative(action.createdAt, now)}
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
          {decision}

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

const ApprovalDetailContent = async ({ params }: ApprovalDetailPageProps) => {
  const { id } = await params;
  const detail = await orNotFound(getAction(apiGetServer, id));
  const now = new Date();

  return (
    <ApprovalDetailView
      decision={
        <ApprovalDecision action={detail.action} canRequestChanges={detail.canRequestChanges} />
      }
      detail={detail}
      now={now}
    />
  );
};

const SAMPLE_NOW = new Date("2026-01-01T12:00:00.000Z");

const SAMPLE_AGENT = { name: "Designer", role: "worker", workerKind: "designer" } as const;

const SAMPLE_COMPANY = {
  companyId: "00000000-0000-4000-8000-000000000100",
  companyName: "Empresa Exemplo",
} as const;

const SAMPLE_DETAIL: ActionDetailResponse = {
  action: {
    ...SAMPLE_COMPANY,
    actionType: "worker_deliverable",
    agent: SAMPLE_AGENT,
    createdAt: SAMPLE_NOW.getTime() - 2 * 60 * 60_000,
    decidedAt: null,
    decidedByName: null,
    feedback: null,
    id: "00000000-0000-4000-8000-000000000001",
    policy: "require_approval",
    proposed: {
      assetIds: [],
      summary:
        "Carrossel com cinco imagens para o lançamento da coleção de verão, com a paleta da marca e chamada para a loja online.\n\nCada imagem destaca uma peça da coleção, e a última traz o cupom de primeira compra.",
    },
    status: "pending",
    ticketId: "00000000-0000-4000-8000-000000000002",
  },
  ageSeconds: 2 * 60 * 60,
  canRequestChanges: true,
  rounds: [],
  ticket: {
    ...SAMPLE_COMPANY,
    agent: SAMPLE_AGENT,
    brief: "Criar um carrossel para o lançamento da coleção de verão no Instagram.",
    id: "00000000-0000-4000-8000-000000000002",
    result: null,
    status: "awaiting_approval",
    title: "Carrossel da coleção de verão",
  },
};

const ApprovalDetailPage = (props: ApprovalDetailPageProps) => (
  <div className="flex flex-col gap-5">
    <BackLink href="/approvals">Aprovações</BackLink>
    <SkeletonSuspense
      label="Carregando aprovação"
      skeleton={
        <ApprovalDetailView
          decision={<SkeletonBox height={296} width="100%" />}
          detail={SAMPLE_DETAIL}
          now={SAMPLE_NOW}
        />
      }
    >
      <ApprovalDetailContent {...props} />
    </SkeletonSuspense>
  </div>
);

export default ApprovalDetailPage;
