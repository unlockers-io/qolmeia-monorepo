import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { agentAvatarClass, agentInitials } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type {
  ActionListRow,
  ActionsResponse,
  ActivityEntry,
  ActivityResponse,
  CompanyRoster,
  TicketListRow,
  TicketsResponse,
} from "@repo/worker-api/contracts";
import { Activity, CircleAlert, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SkeletonSuspense } from "skullet/react";

import { activityStyle } from "@/lib/activity-category";
import { apiGetServer } from "@/lib/api-server";
import { actionTypeLabel, formatDurationSeconds, formatRelative } from "@/lib/format";
import { log } from "@/lib/observability";

import { CompanySummary, PendingSummary, TicketSummary } from "./home-summary";

export const metadata: Metadata = { title: "Início" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const UNAVAILABLE = "Não foi possível carregar";

const loadRecentEvents = async (): Promise<ActivityResponse | null> => {
  try {
    return await apiGetServer<ActivityResponse>("/activity?limit=8");
  } catch (error) {
    log.error({ error, message: "home: failed to load recent activity" });

    return null;
  }
};

const LoadError = ({ what }: { what: string }) => (
  <EmptyState
    description={`${UNAVAILABLE} ${what} agora. Atualize a página em instantes.`}
    icon={<CircleAlert aria-hidden />}
    title="Dados indisponíveis"
  />
);

type RecentEvent = Pick<ActivityEntry, "companyName" | "createdAt" | "id" | "summary" | "type">;

const RecentEventsList = ({ items, now }: { items: ReadonlyArray<RecentEvent>; now: Date }) => (
  <ul className="flex flex-col px-4.5 py-1.5">
    {items.slice(0, 6).map((row) => {
      const style = activityStyle(row.type);

      return (
        <li className="flex gap-2.75 border-b border-border py-2.5 last:border-b-0" key={row.id}>
          <span aria-hidden className={cn("mt-1.5 size-1.75 shrink-0 rounded-full", style.dot)} />
          <div className="min-w-0">
            <p className="text-(length:--text-label) leading-snug text-foreground">{row.summary}</p>
            <p className="mt-0.75 text-xs text-muted-foreground">
              {row.companyName} · {style.label} · {formatRelative(row.createdAt, now)}
            </p>
          </div>
        </li>
      );
    })}
  </ul>
);

const RecentEvents = async ({ activity }: { activity: Promise<ActivityResponse | null> }) => {
  const response = await activity;

  if (response === null) {
    return <LoadError what="os eventos" />;
  }

  if (response.items.length === 0) {
    return (
      <EmptyState
        description="Quando os agentes começarem a trabalhar, os eventos aparecem aqui."
        icon={<Activity aria-hidden />}
        title="Nada para mostrar ainda"
      />
    );
  }

  const now = new Date();

  return <RecentEventsList items={response.items} now={now} />;
};

type PendingAction = Pick<
  ActionListRow,
  "actionType" | "ageSeconds" | "agent" | "companyName" | "id"
>;

type HomeViewProps = {
  companies: ReadonlyArray<Pick<CompanyRoster, "status">> | null;
  now: Date;
  pending: ReadonlyArray<PendingAction> | null;
  recentEvents: ReactNode;
  tickets: ReadonlyArray<Pick<TicketListRow, "status" | "updatedAt">> | null;
};

const HomeView = ({ companies, now, pending, recentEvents, tickets }: HomeViewProps) => (
  <div className="flex flex-col gap-6">
    <Card className="gap-0 overflow-hidden p-0">
      <dl className="grid divide-border max-lg:divide-y sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
        <PendingSummary pending={pending} />
        <TicketSummary now={now} tickets={tickets} />
        <CompanySummary companies={companies} />
      </dl>
    </Card>
    <div className="grid gap-3.5 lg:grid-cols-approval">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex items-center border-b border-border px-4.5 py-3.75">
          <h2 className="text-(length:--text-body-sm) font-bold text-foreground">
            Próximas aprovações
          </h2>
          <Link
            className="ml-auto rounded-sm py-2 text-(length:--text-label-sm) font-semibold text-primary transition-colors outline-none hover:text-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
            href="/approvals"
          >
            Ver todas
          </Link>
        </div>
        {pending === null && <LoadError what="a fila de aprovações" />}
        {pending?.length === 0 && (
          <EmptyState
            description="Quando um agente propuser uma ação, ela aparece aqui para decisão."
            icon={<Inbox aria-hidden />}
            title="Nenhuma aprovação pendente"
          />
        )}
        {pending !== null && pending.length > 0 && (
          <ul className="flex flex-col">
            {pending.slice(0, 4).map((action) => (
              <li className="border-b border-border last:border-b-0" key={action.id}>
                <Link
                  className="flex items-center gap-3 px-4.5 py-3.25 transition-colors outline-none hover:bg-highlight-surface/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  href={`/approvals/${action.id}`}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-8.5 shrink-0 items-center justify-center rounded-panel-sm text-(length:--text-label) font-bold text-white",
                      agentAvatarClass(action.agent.role, action.agent.workerKind),
                    )}
                  >
                    {agentInitials(action.agent.name)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-(length:--text-label-lg) font-semibold text-foreground">
                      {actionTypeLabel(action.actionType)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {action.companyName} · {action.agent.name}
                    </span>
                  </div>
                  {action.ageSeconds === undefined ? null : (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDurationSeconds(action.ageSeconds)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-4.5 py-3.75">
          <h2 className="text-(length:--text-body-sm) font-bold text-foreground">
            Eventos recentes
          </h2>
        </div>
        {recentEvents}
      </Card>
    </div>
  </div>
);

const SAMPLE_NOW = new Date("2026-01-01T12:00:00.000Z");

const SAMPLE_EVENTS: ReadonlyArray<RecentEvent> = [
  {
    companyName: "Empresa Exemplo",
    createdAt: SAMPLE_NOW.getTime() - 4 * 60_000,
    id: "00000000-0000-4000-8000-000000000001",
    summary: "Entrega revisada (revisão 2) aguardando decisão.",
    type: "ACTION_PROPOSED",
  },
  {
    companyName: "Outra Empresa",
    createdAt: SAMPLE_NOW.getTime() - 35 * 60_000,
    id: "00000000-0000-4000-8000-000000000002",
    summary: "Ação aprovada.",
    type: "ACTION_APPROVED",
  },
  {
    companyName: "Empresa Exemplo",
    createdAt: SAMPLE_NOW.getTime() - 2 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000003",
    summary: 'Agente "Redator" contratado.',
    type: "MEMBER_HIRED",
  },
  {
    companyName: "Loja Nova",
    createdAt: SAMPLE_NOW.getTime() - 5 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000004",
    summary: "Convite enviado para contato@lojanova.com.br.",
    type: "CUSTOMER_INVITED",
  },
  {
    companyName: "Outra Empresa",
    createdAt: SAMPLE_NOW.getTime() - 26 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000005",
    summary: "Time confirmado pelo cliente.",
    type: "TEAM_CONFIRMED",
  },
  {
    companyName: "Empresa Exemplo",
    createdAt: SAMPLE_NOW.getTime() - 30 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000006",
    summary: "Ação rejeitada.",
    type: "ACTION_REJECTED",
  },
];

const SAMPLE_PENDING: ReadonlyArray<PendingAction> = [
  {
    actionType: "worker_deliverable",
    agent: { name: "Designer", role: "worker", workerKind: "designer" },
    ageSeconds: 3 * 60 * 60,
    companyName: "Empresa Exemplo",
    id: "00000000-0000-4000-8000-000000000011",
  },
  {
    actionType: "publish_post",
    agent: { name: "Redator", role: "worker", workerKind: "copywriter" },
    ageSeconds: 40 * 60,
    companyName: "Outra Empresa",
    id: "00000000-0000-4000-8000-000000000012",
  },
  {
    actionType: "worker_deliverable",
    agent: { name: "Designer", role: "worker", workerKind: "designer" },
    ageSeconds: 4 * 60,
    companyName: "Loja Nova",
    id: "00000000-0000-4000-8000-000000000013",
  },
];

const SAMPLE_TICKETS: HomeViewProps["tickets"] = [
  { status: "awaiting_approval", updatedAt: SAMPLE_NOW.getTime() },
  { status: "in_progress", updatedAt: SAMPLE_NOW.getTime() },
  { status: "done", updatedAt: SAMPLE_NOW.getTime() },
];

const SAMPLE_COMPANIES: HomeViewProps["companies"] = [
  { status: "active" },
  { status: "active" },
  { status: "onboarding" },
];

const SAMPLE_RECENT_EVENTS = <RecentEventsList items={SAMPLE_EVENTS} now={SAMPLE_NOW} />;

const HomeContent = async () => {
  const activity = loadRecentEvents();

  const [pendingRes, ticketsRes, companiesRes] = await Promise.allSettled([
    apiGetServer<ActionsResponse>("/actions?status=pending&sort=age"),
    apiGetServer<TicketsResponse>("/tickets?limit=200"),
    apiGetServer<{ companies: Array<CompanyRoster> }>("/companies"),
  ]);

  const pending = pendingRes.status === "fulfilled" ? pendingRes.value.items : null;
  const tickets = ticketsRes.status === "fulfilled" ? ticketsRes.value.items : null;
  const companies = companiesRes.status === "fulfilled" ? companiesRes.value.companies : null;
  const now = new Date();

  return (
    <HomeView
      companies={companies}
      now={now}
      pending={pending}
      recentEvents={
        <SkeletonSuspense label="Carregando eventos" skeleton={SAMPLE_RECENT_EVENTS}>
          <RecentEvents activity={activity} />
        </SkeletonSuspense>
      }
      tickets={tickets}
    />
  );
};

const Home = () => (
  <div className="flex flex-col gap-6">
    <PageHeader description="Visão operacional de todas as empresas" title="Início" />
    <SkeletonSuspense
      label="Carregando visão geral"
      skeleton={
        <HomeView
          companies={SAMPLE_COMPANIES}
          now={SAMPLE_NOW}
          pending={SAMPLE_PENDING}
          recentEvents={SAMPLE_RECENT_EVENTS}
          tickets={SAMPLE_TICKETS}
        />
      }
    >
      <HomeContent />
    </SkeletonSuspense>
  </div>
);

export default Home;
