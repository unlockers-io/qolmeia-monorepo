import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { agentAvatarClass, agentInitials } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type {
  ActionsResponse,
  ActivityResponse,
  CompanyRoster,
  TicketsResponse,
} from "@repo/worker-api/contracts";
import { Activity, CircleAlert, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { activityStyle } from "@/lib/activity-category";
import { apiGetServer } from "@/lib/api-server";
import { actionTypeLabel, formatDurationSeconds, formatRelative } from "@/lib/format";
import { log } from "@/lib/observability";

export const metadata: Metadata = { title: "Início" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const UNAVAILABLE = "Não foi possível carregar";

type SummaryItemProps = {
  emphasis?: boolean;
  href?: string;
  label: string;
  sub?: string;
  value: number | null;
};

const SummaryItem = ({ emphasis = false, href, label, sub, value }: SummaryItemProps) => {
  const content = (
    <>
      <dt className="text-(length:--text-label) text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
          emphasis ? "text-warning-surface-foreground" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{value === null ? UNAVAILABLE : sub}</dd>
    </>
  );
  return href === undefined ? (
    <div className="px-5 py-4">{content}</div>
  ) : (
    <Link
      className="block px-5 py-4 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      href={href}
    >
      {content}
    </Link>
  );
};

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

  return (
    <ul className="flex flex-col px-4.5 py-1.5">
      {response.items.slice(0, 6).map((row) => {
        const style = activityStyle(row.type);
        return (
          <li className="flex gap-2.75 border-b border-border py-2.5 last:border-b-0" key={row.id}>
            <span aria-hidden className={cn("mt-1.5 size-1.75 shrink-0 rounded-full", style.dot)} />
            <div className="min-w-0">
              <p className="text-(length:--text-label) leading-snug text-foreground">
                {row.summary}
              </p>
              <p className="mt-0.75 text-xs text-muted-foreground">
                {row.companyName} · {style.label} · {formatRelative(row.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const RecentEventsSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-3 px-4.5 py-4">
    {Array.from({ length: 5 }, (_, index) => (
      <Skeleton className="h-9 w-full" key={index} />
    ))}
  </div>
);

const OPEN_STATUSES = new Set(["in_progress", "open", "awaiting_approval"]);

const startOfMonth = (now: Date): number =>
  new Date(now.getFullYear(), now.getMonth(), 1).getTime();

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

  const monthStart = startOfMonth(new Date());
  const openTickets = tickets?.filter((t) => OPEN_STATUSES.has(t.status)).length ?? null;
  const doneThisMonth =
    tickets?.filter((t) => t.status === "done" && t.updatedAt >= monthStart).length ?? null;
  const oldestPendingAge = pending?.[0]?.ageSeconds;
  const activeCompanies = companies?.filter((c) => c.status === "active").length ?? null;
  const onboardingCompanies = companies?.filter((c) => c.status === "onboarding").length ?? 0;
  const pendingCount = pending?.length ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-0 overflow-hidden p-0">
        <dl className="grid divide-border max-lg:divide-y sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          <SummaryItem
            emphasis={pendingCount !== null && pendingCount > 0}
            href="/approvals"
            label="Aprovações pendentes"
            sub={
              oldestPendingAge === undefined
                ? "Fila em dia"
                : `A mais antiga há ${formatDurationSeconds(oldestPendingAge)}`
            }
            value={pendingCount}
          />
          <SummaryItem
            href="/tickets"
            label="Tickets abertos"
            sub={tickets === null ? undefined : `De ${tickets.length} no total`}
            value={openTickets}
          />
          <SummaryItem label="Concluídos no mês" sub="Tickets entregues" value={doneThisMonth} />
          <SummaryItem
            href="/teams"
            label="Empresas ativas"
            sub={`${onboardingCompanies} em onboarding`}
            value={activeCompanies}
          />
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
          <Suspense fallback={<RecentEventsSkeleton />}>
            <RecentEvents activity={activity} />
          </Suspense>
        </Card>
      </div>
    </div>
  );
};

const HomeSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <Skeleton className="h-24" />
    <div className="grid gap-3.5 lg:grid-cols-approval">
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  </div>
);

const Home = () => (
  <div className="flex flex-col gap-6">
    <PageHeader description="Visão operacional de todas as empresas" title="Início" />
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  </div>
);

export default Home;
