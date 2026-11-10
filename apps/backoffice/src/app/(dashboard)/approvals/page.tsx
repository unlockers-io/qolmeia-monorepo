import { agentAvatarClass, agentInitials } from "@repo/app-shell/agent-avatar";
import { apiGetServer } from "@repo/app-shell/server-api";
import { buttonVariants } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { cn } from "@repo/ui/lib/utils";
import type { PendingAction } from "@repo/worker-api/contracts";
import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SkeletonSuspense } from "skullet/react";

import { ACTION_TYPE_VIEWS } from "@/components/action-types";
import { getCoverage, getPendingActions } from "@/lib/backoffice-api";
import { type AgeTier, ageTier, formatDurationSeconds, truncate } from "@/lib/format";

export const metadata: Metadata = { title: "Aprovações" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const AGE_TIER_CLASS = {
  calm: "text-muted-foreground",
  urgent: "font-semibold text-destructive-surface-foreground",
  warning: "font-semibold text-warning-surface-foreground",
} satisfies Record<AgeTier, string>;

type ApprovalItem = Pick<
  PendingAction,
  "actionType" | "ageSeconds" | "agent" | "companyName" | "id"
> & {
  proposed: Pick<PendingAction["proposed"], "summary">;
};

type ApprovalsViewProps = {
  filtered: boolean;
  items: ReadonlyArray<ApprovalItem>;
};

const PendingBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <span className="rounded-full bg-warning-surface px-3 py-1.5 text-sm font-semibold text-warning-surface-foreground">
      {count} {count === 1 ? "pendente" : "pendentes"}
    </span>
  ) : null;

const ApprovalsDescription = ({ filtered }: { filtered: boolean }) =>
  filtered ? (
    <>
      Mostrando só o que está na sua cobertura, mais antigas primeiro.{" "}
      <Link
        className="rounded-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        href="/cobertura"
      >
        Ajustar cobertura
      </Link>
    </>
  ) : (
    "Ações propostas pelos especialistas aguardando uma decisão, mais antigas primeiro."
  );

const ApprovalsView = ({ filtered, items }: ApprovalsViewProps) => {
  const pendingCount = items.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={<PendingBadge count={pendingCount} />}
        description={<ApprovalsDescription filtered={filtered} />}
        title="Aprovações"
      />

      <Card className="gap-0 overflow-hidden py-0">
        {pendingCount === 0 ? (
          <EmptyState
            className="py-12"
            description="Os agentes estão executando livremente. Quando algo precisar do seu olho, aparece aqui."
            icon={<Inbox aria-hidden />}
            title="Sem nada na fila"
          />
        ) : (
          <div>
            <div
              aria-hidden
              className="hidden grid-cols-approvals items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3 font-mono text-xs tracking-wide text-muted-foreground uppercase md:grid"
            >
              <span>Ação</span>
              <span>Empresa</span>
              <span>Agente</span>
              <span>Aguardando</span>
              <span />
            </div>
            <ul className="flex flex-col">
              {items.map((action) => {
                const preview = action.proposed.summary.split("\n")[0]?.trim() ?? "";

                return (
                  <li className="border-b border-border/60 last:border-b-0" key={action.id}>
                    <Link
                      className="grid gap-3 px-4 py-4 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-2 md:grid-cols-approvals md:items-center md:px-5 md:py-3.5"
                      href={`/approvals/${action.id}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5 sm:col-span-2 md:col-span-1">
                        <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {ACTION_TYPE_VIEWS[action.actionType].label}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {preview ? (
                              truncate(preview, 72)
                            ) : (
                              <span className="font-mono">{action.id}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="truncate text-sm text-muted-foreground">
                        <span className="text-xs font-medium md:hidden">Empresa · </span>
                        {action.companyName}
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${agentAvatarClass(action.agent.role, action.agent.workerKind)}`}
                        >
                          {agentInitials(action.agent.name)}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {action.agent.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          AGE_TIER_CLASS[ageTier(action.ageSeconds)],
                        )}
                      >
                        <span className="font-medium md:hidden">Aguardando · </span>
                        {formatDurationSeconds(action.ageSeconds)}
                      </span>
                      <span
                        aria-hidden
                        className={cn(buttonVariants({ className: "w-full", size: "sm" }))}
                      >
                        Revisar
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
};

const ApprovalsContent = async () => {
  const [res, coverage] = await Promise.all([
    getPendingActions(apiGetServer),
    getCoverage(apiGetServer).catch(() => null),
  ]);

  const filtered =
    coverage !== null &&
    (coverage.assigned.companies.length > 0 || coverage.assigned.disciplines.length > 0);

  return <ApprovalsView filtered={filtered} items={res.items} />;
};

const SAMPLE_APPROVALS: ReadonlyArray<ApprovalItem> = [
  {
    actionType: "worker_deliverable",
    agent: { name: "Designer", role: "worker", workerKind: "designer" },
    ageSeconds: 5 * 60 * 60,
    companyName: "Empresa Exemplo",
    id: "00000000-0000-4000-8000-000000000001",
    proposed: { summary: "Carrossel com cinco imagens para o lançamento da coleção de verão" },
  },
  {
    actionType: "publish_post",
    agent: { name: "Redator", role: "worker", workerKind: "copywriter" },
    ageSeconds: 90 * 60,
    companyName: "Outra Empresa",
    id: "00000000-0000-4000-8000-000000000002",
    proposed: { summary: "Legenda e hashtags para o post de quinta-feira" },
  },
  {
    actionType: "worker_deliverable",
    agent: { name: "Designer", role: "worker", workerKind: "designer" },
    ageSeconds: 12 * 60,
    companyName: "Loja Nova",
    id: "00000000-0000-4000-8000-000000000003",
    proposed: { summary: "Banner da promoção de fim de semana" },
  },
];

const ApprovalsPage = () => (
  <SkeletonSuspense
    label="Carregando aprovações"
    skeleton={<ApprovalsView filtered={false} items={SAMPLE_APPROVALS} />}
  >
    <ApprovalsContent />
  </SkeletonSuspense>
);

export default ApprovalsPage;
