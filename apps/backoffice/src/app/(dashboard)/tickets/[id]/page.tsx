import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import { agentAvatarClass, agentInitials } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type { Action, TicketDetailResponse, WireObject } from "@repo/worker-api/contracts";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { StatusPill } from "@/components/status-pill";
import { ApiError } from "@/lib/api-client";
import { apiGetServer } from "@/lib/api-server";
import { actionTypeLabel, formatRelative, truncate } from "@/lib/format";

export const metadata: Metadata = { title: "Ticket" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type TicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

type StepTone = "done" | "current" | "waiting" | "blocked";

type StepToneContract = Record<Action["status"], StepTone>;

const STEP_TONE = {
  approved: "current",
  changes_requested: "waiting",
  executed: "done",
  pending: "waiting",
  rejected: "blocked",
} satisfies StepToneContract;

type StepDotContract = Record<StepTone, string>;

const STEP_DOT = {
  blocked: "border-destructive bg-destructive",
  current: "border-info bg-info",
  done: "border-success bg-success",
  waiting: "border-warning bg-warning",
} satisfies StepDotContract;

const PENDING_DELIVERABLE = {
  awaiting_approval: "Aguardando aprovação",
  blocked: "Não entregue",
  cancelled: "Não entregue",
  done: "Concluído sem material",
  in_progress: "Em produção",
  open: "Na fila",
  rejected: "Rejeitado: não será entregue",
} satisfies Record<TicketDetailResponse["ticket"]["status"], string>;

const deliverableSummary = (result: WireObject | null): string | null =>
  typeof result?.summary === "string" && result.summary !== "" ? result.summary : null;

const TicketDetailContent = async ({ params }: TicketDetailPageProps) => {
  const { id } = await params;

  let detail: TicketDetailResponse | null = null;
  try {
    detail = await apiGetServer<TicketDetailResponse>(`/tickets/${id}`);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }
  if (!detail) {
    notFound();
  }

  const { actions, ticket } = detail;
  const relatedAction = actions.at(-1) ?? null;
  const summary = deliverableSummary(ticket.result);

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
        <StatusPill status={ticket.status} />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-ticket-detail">
        <div className="flex flex-col gap-4">
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
                    const tone = STEP_TONE[action.status];
                    const isLast = index === actions.length - 1;
                    return (
                      <li className="flex gap-3.5" key={action.id}>
                        <div className="flex flex-col items-center">
                          <span
                            aria-hidden
                            className={cn("size-4 shrink-0 rounded-full border-2", STEP_DOT[tone])}
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
                                ? `Rodada ${index + 1} · ${actionTypeLabel(action.actionType)}`
                                : actionTypeLabel(action.actionType)}
                            </Link>
                            <StatusPill status={action.status} />
                          </div>
                          {action.feedback !== null && action.feedback !== "" && (
                            <p className="text-sm text-muted-foreground">“{action.feedback}”</p>
                          )}
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatRelative(action.createdAt)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden p-0">
            <div className="border-b border-border px-5 py-3.5 text-sm font-bold text-foreground">
              Entregável
            </div>
            {summary === null ? (
              <div className="flex h-40 items-center justify-center bg-muted/40">
                <span className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                  {PENDING_DELIVERABLE[ticket.status]}
                </span>
              </div>
            ) : (
              <div className="bg-muted/40 px-5 py-4 text-sm leading-relaxed text-foreground">
                <MarkdownResponse>{summary}</MarkdownResponse>
              </div>
            )}
            <div className="border-t border-border px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {ticket.brief}
            </div>
          </Card>
        </div>

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
                  <span className="truncate font-semibold text-foreground">
                    {ticket.agent.name}
                  </span>
                </span>
              </div>
              {relatedAction && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="truncate font-semibold text-foreground">
                    {actionTypeLabel(relatedAction.actionType)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Workflow</span>
                <span className="truncate font-mono text-xs font-semibold text-foreground">
                  {ticket.workflowId ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <StatusPill status={ticket.status} />
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
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      STEP_DOT[STEP_TONE[relatedAction.status]],
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-(length:--text-label) font-semibold text-foreground">
                    {actionTypeLabel(relatedAction.actionType)}
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const TicketDetailSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <Skeleton className="h-8 w-72" />
    <Skeleton className="h-48 w-full" />
    <Skeleton className="h-48 w-full" />
  </div>
);

const TicketDetailPage = (props: TicketDetailPageProps) => (
  <div className="flex flex-col gap-6">
    <BackLink href="/tickets">Tickets</BackLink>
    <Suspense fallback={<TicketDetailSkeleton />}>
      <TicketDetailContent {...props} />
    </Suspense>
  </div>
);

export default TicketDetailPage;
