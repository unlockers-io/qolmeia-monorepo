import { agentAvatarClass, agentInitials } from "@repo/app-shell/agent-avatar";
import { apiGetServer } from "@repo/app-shell/server-api";
import { Card, CardContent } from "@repo/ui/components/card";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import { cn } from "@repo/ui/lib/utils";
import type { ActionStatus, TicketDetailResponse, TicketStatus } from "@repo/worker-api/contracts";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SkeletonSuspense } from "skullet/react";

import { ACTION_TYPE_VIEWS } from "@/components/action-types";
import { BackLink } from "@/components/back-link";
import { getTicket } from "@/lib/backoffice-api";
import { formatRelative, truncate } from "@/lib/format";
import { orNotFound } from "@/lib/or-not-found";
import { ACTION_STATUS, TICKET_STATUS } from "@/lib/status";

export const metadata: Metadata = { title: "Ticket" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type TicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

const STEP_DOT = {
  approved: "border-info bg-info",
  changes_requested: "border-warning bg-warning",
  executed: "border-success bg-success",
  pending: "border-warning bg-warning",
  rejected: "border-destructive bg-destructive",
} satisfies Record<ActionStatus, string>;

const PENDING_DELIVERABLE = {
  awaiting_approval: "Aguardando aprovação",
  blocked: "Não entregue",
  cancelled: "Não entregue",
  done: "Concluído sem material",
  in_progress: "Em produção",
  open: "Na fila",
  rejected: "Rejeitado: não será entregue",
} satisfies Record<TicketStatus, string>;

type TicketDetailProps = {
  actions: ReadonlyArray<
    Pick<
      TicketDetailResponse["actions"][number],
      "actionType" | "createdAt" | "feedback" | "id" | "status"
    >
  >;
  now: Date;
  ticket: Pick<
    TicketDetailResponse["ticket"],
    "agent" | "brief" | "companyName" | "id" | "result" | "status"
  >;
};

type TicketAction = TicketDetailProps["actions"][number];

const ExecutionCard = ({ actions, now }: Pick<TicketDetailProps, "actions" | "now">) => (
  <Card>
    <CardContent>
      <div className="mb-4 text-sm font-bold text-foreground">Execução</div>
      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma etapa registrada neste ticket ainda.
        </p>
      ) : (
        <ol className="flex flex-col">
          {actions.map((action, index) => {
            const status = ACTION_STATUS[action.status];
            const isLast = index === actions.length - 1;

            return (
              <li className="flex gap-3.5" key={action.id}>
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden
                    className={cn("size-4 shrink-0 rounded-full border-2", STEP_DOT[action.status])}
                  />
                  {!isLast && <span className="min-h-4.5 w-0.5 flex-1 bg-border" />}
                </div>
                <div className={cn("flex min-w-0 flex-col gap-1 pb-4", isLast && "pb-0")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="text-sm leading-snug font-medium text-foreground transition-colors hover:text-primary"
                      href={`/approvals/${action.id}`}
                    >
                      {actions.length > 1
                        ? `Rodada ${index + 1} · ${ACTION_TYPE_VIEWS[action.actionType].label}`
                        : ACTION_TYPE_VIEWS[action.actionType].label}
                    </Link>
                    <StatusPill {...status} />
                  </div>
                  {action.feedback !== null && action.feedback !== "" && (
                    <p className="text-sm text-muted-foreground">“{action.feedback}”</p>
                  )}
                  <div className="font-mono text-xs text-muted-foreground">
                    {formatRelative(action.createdAt, now)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </CardContent>
  </Card>
);

type DeliverableCardProps = Pick<TicketDetailProps["ticket"], "brief" | "status"> & {
  summary: string;
};

const DeliverableCard = ({ brief, status, summary }: DeliverableCardProps) => (
  <Card className="gap-0 overflow-hidden p-0">
    <div className="border-b border-border px-5 py-3.5 text-sm font-bold text-foreground">
      Entregável
    </div>
    {summary === "" ? (
      <div className="flex h-40 items-center justify-center bg-muted/40">
        <span className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
          {PENDING_DELIVERABLE[status]}
        </span>
      </div>
    ) : (
      <div className="bg-muted/40 px-5 py-4 text-sm leading-relaxed text-foreground">
        <MarkdownResponse>{summary}</MarkdownResponse>
      </div>
    )}
    <div className="border-t border-border px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
      {brief}
    </div>
  </Card>
);

type TicketDetailsCardProps = {
  relatedAction: TicketAction | null;
  ticket: TicketDetailProps["ticket"];
};

const TicketDetailsCard = ({ relatedAction, ticket }: TicketDetailsCardProps) => (
  <Card>
    <CardContent>
      <div className="mb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Detalhes
      </div>
      <div className="flex flex-col gap-2.5 text-(length:--text-label)">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Empresa</span>
          <span className="truncate font-semibold text-foreground">{ticket.companyName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Agente</span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "flex size-5 flex-none items-center justify-center rounded-lg text-xs font-bold text-white",
                agentAvatarClass(ticket.agent.role, ticket.agent.workerKind),
              )}
            >
              {agentInitials(ticket.agent.name)}
            </span>
            <span className="truncate font-semibold text-foreground">{ticket.agent.name}</span>
          </span>
        </div>
        {relatedAction && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Tipo</span>
            <span className="truncate font-semibold text-foreground">
              {ACTION_TYPE_VIEWS[relatedAction.actionType].label}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Status</span>
          <StatusPill {...TICKET_STATUS[ticket.status]} />
        </div>
      </div>

      {relatedAction && (
        <div className="mt-4 border-t border-border pt-3.5">
          <div className="mb-2 text-xs text-muted-foreground">Ação relacionada</div>
          <Link
            className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors outline-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            href={`/approvals/${relatedAction.id}`}
          >
            <span
              aria-hidden
              className={cn("size-2 shrink-0 rounded-full", STEP_DOT[relatedAction.status])}
            />
            <span className="min-w-0 flex-1 truncate text-(length:--text-label) font-semibold text-foreground">
              {ACTION_TYPE_VIEWS[relatedAction.actionType].label}
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      )}
    </CardContent>
  </Card>
);

const TicketDetail = ({ actions, now, ticket }: TicketDetailProps) => {
  const relatedAction = actions.at(-1) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 font-mono text-xs text-muted-foreground">{ticket.id}</div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {truncate(ticket.brief, 80)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{ticket.companyName}</span>
            <span aria-hidden>·</span>
            <span>{ticket.agent.name}</span>
          </div>
        </div>
        <StatusPill {...TICKET_STATUS[ticket.status]} />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-ticket-detail">
        <div className="flex flex-col gap-4">
          <ExecutionCard actions={actions} now={now} />
          <DeliverableCard
            brief={ticket.brief}
            status={ticket.status}
            summary={ticket.result?.summary ?? ""}
          />
        </div>
        <TicketDetailsCard relatedAction={relatedAction} ticket={ticket} />
      </div>
    </div>
  );
};

const TicketDetailContent = async ({ params }: TicketDetailPageProps) => {
  const { id } = await params;
  const { actions, ticket } = await orNotFound(getTicket(apiGetServer, id));
  const now = new Date();

  return <TicketDetail actions={actions} now={now} ticket={ticket} />;
};

const SAMPLE_NOW = new Date("2026-01-01T12:00:00.000Z");

const SAMPLE_TICKET: TicketDetailProps["ticket"] = {
  agent: { name: "Designer", role: "worker", workerKind: "designer" },
  brief:
    "Criar um carrossel de cinco imagens para o lançamento da coleção de verão, no tom da marca.",
  companyName: "Empresa Exemplo",
  id: "00000000-0000-4000-8000-000000000001",
  result: null,
  status: "awaiting_approval",
};

const SAMPLE_ACTIONS: TicketDetailProps["actions"] = [
  {
    actionType: "worker_deliverable",
    createdAt: SAMPLE_NOW.getTime() - 5 * 60_000,
    feedback: null,
    id: "00000000-0000-4000-8000-000000000002",
    status: "pending",
  },
];

const TicketDetailPage = (props: TicketDetailPageProps) => (
  <div className="flex flex-col gap-6">
    <BackLink href="/tickets">Tickets</BackLink>
    <SkeletonSuspense
      label="Carregando ticket"
      skeleton={<TicketDetail actions={SAMPLE_ACTIONS} now={SAMPLE_NOW} ticket={SAMPLE_TICKET} />}
    >
      <TicketDetailContent {...props} />
    </SkeletonSuspense>
  </div>
);

export default TicketDetailPage;
