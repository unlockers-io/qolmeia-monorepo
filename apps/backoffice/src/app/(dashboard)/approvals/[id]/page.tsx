import type {
  Action,
  ActionDetailResponse,
  ActionStatus,
  TicketDetailResponse,
} from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { SkeletonSuspense } from "skullet/react";

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

type ApprovalDetailViewProps = {
  detail: ActionDetailResponse;
  now: Date;
  rounds: ReadonlyArray<Action>;
};

const ApprovalDetailView = ({ detail, now, rounds }: ApprovalDetailViewProps) => {
  const { action, ageSeconds, canRequestChanges, ticket } = detail;
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
              {actionTypeLabel(action.actionType)}
            </span>
            {rounds.length > 1 && roundIndex !== -1 ? ` · Rodada ${roundIndex + 1}` : ""} ·{" "}
            {policyCopy} · {formatRelative(action.createdAt, now)}
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

  const rounds = detail.ticket === null ? [] : await loadTicketActions(detail.ticket.id);
  const now = new Date();

  return <ApprovalDetailView detail={detail} now={now} rounds={rounds} />;
};

const SAMPLE_NOW = new Date("2026-01-01T12:00:00.000Z");

const SAMPLE_AGENT = { name: "Designer", role: "worker", workerKind: "designer" } as const;

const SAMPLE_DETAIL: ActionDetailResponse = {
  action: {
    actionType: "worker_deliverable",
    agent: SAMPLE_AGENT,
    companyId: "00000000-0000-4000-8000-000000000100",
    companyName: "Empresa Exemplo",
    createdAt: SAMPLE_NOW.getTime() - 2 * 60 * 60_000,
    decidedAt: null,
    decidedByName: null,
    decidedByUserId: null,
    feedback: null,
    id: "00000000-0000-4000-8000-000000000001",
    policy: "require_approval",
    proposed: {
      summary:
        "Carrossel com cinco imagens para o lançamento da coleção de verão, com a paleta da marca e chamada para a loja online.\n\nCada imagem destaca uma peça da coleção, e a última traz o cupom de primeira compra.",
    },
    status: "pending",
    ticketId: "00000000-0000-4000-8000-000000000002",
  },
  ageSeconds: 2 * 60 * 60,
  canRequestChanges: true,
  ticket: {
    agent: SAMPLE_AGENT,
    agentInstanceId: "00000000-0000-4000-8000-000000000003",
    brief: "Criar um carrossel para o lançamento da coleção de verão no Instagram.",
    companyId: "00000000-0000-4000-8000-000000000100",
    companyName: "Empresa Exemplo",
    id: "00000000-0000-4000-8000-000000000002",
    result: null,
    status: "awaiting_approval",
    workflowId: null,
  },
};

const ApprovalDetailPage = (props: ApprovalDetailPageProps) => (
  <div className="flex flex-col gap-5">
    <BackLink href="/approvals">Aprovações</BackLink>
    <SkeletonSuspense
      label="Carregando aprovação"
      skeleton={<ApprovalDetailView detail={SAMPLE_DETAIL} now={SAMPLE_NOW} rounds={[]} />}
    >
      <ApprovalDetailContent {...props} />
    </SkeletonSuspense>
  </div>
);

export default ApprovalDetailPage;
