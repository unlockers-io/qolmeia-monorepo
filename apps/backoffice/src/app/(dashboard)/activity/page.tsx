import { apiGetServer } from "@repo/app-shell/server-api";
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { cn } from "@repo/ui/lib/utils";
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ActivityEntry,
} from "@repo/worker-api/contracts";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SkeletonSuspense } from "skullet/react";

import { ActivityList } from "@/components/activity-list";
import { CATEGORY_STYLE } from "@/lib/activity-category";
import { ACTIVITY_PAGE_SIZE, getActivity } from "@/lib/backoffice-api";

export const metadata: Metadata = { title: "Atividade" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const FilterChips = ({ active }: { active: ActivityCategory | undefined }) => (
  <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
    <Link
      aria-current={active === undefined ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold",
        active === undefined
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground",
      )}
      href="/activity"
    >
      Tudo
    </Link>
    {ACTIVITY_CATEGORIES.map((category) => (
      <Link
        aria-current={active === category ? "page" : undefined}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold",
          active === category
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-muted-foreground",
        )}
        href={`/activity?category=${category}`}
        key={category}
      >
        {CATEGORY_STYLE[category].label}
      </Link>
    ))}
  </nav>
);

type ActivitySearchParams = Promise<Record<string, string | Array<string> | undefined>>;

type ActivityFeedCardProps = {
  category: ActivityCategory | undefined;
  items: ReadonlyArray<ActivityEntry>;
  now?: Date;
};

const emptyFeedDescription = (category: ActivityCategory | undefined): string =>
  category === undefined
    ? "Quando os agentes começarem a trabalhar, os eventos aparecem aqui."
    : `Nenhum evento em ${CATEGORY_STYLE[category].label.toLocaleLowerCase("pt-BR")} ainda.`;

const ActivityFeedCard = ({ category, items, now }: ActivityFeedCardProps) => (
  <Card>
    <CardContent className="px-0">
      {items.length === 0 ? (
        <EmptyState
          description={emptyFeedDescription(category)}
          icon={<Activity aria-hidden />}
          title="Nenhum evento ainda"
        />
      ) : (
        <ActivityList
          category={category}
          initial={items}
          key={`${category ?? "all"}-${items[0]?.id}`}
          now={now}
        />
      )}
    </CardContent>
  </Card>
);

const ActivityFeed = async ({ category }: { category: ActivityCategory | undefined }) => {
  const res = await getActivity(apiGetServer, { category, limit: ACTIVITY_PAGE_SIZE });

  return <ActivityFeedCard category={category} items={res.items} />;
};

const SAMPLE_NOW = new Date("2026-01-01T12:00:00.000Z");

const SAMPLE_ENTRY = {
  companyId: "00000000-0000-4000-8000-000000000100",
  companyName: "Empresa Exemplo",
  payload: null,
} as const;

const SAMPLE_ACTIVITY: ReadonlyArray<ActivityEntry> = [
  {
    ...SAMPLE_ENTRY,
    createdAt: SAMPLE_NOW.getTime() - 4 * 60_000,
    id: "00000000-0000-4000-8000-000000000001",
    summary: "Entrega revisada (revisão 2) aguardando decisão.",
    type: "ACTION_PROPOSED",
  },
  {
    ...SAMPLE_ENTRY,
    companyName: "Outra Empresa",
    createdAt: SAMPLE_NOW.getTime() - 35 * 60_000,
    id: "00000000-0000-4000-8000-000000000002",
    summary: "Ação aprovada.",
    type: "ACTION_APPROVED",
  },
  {
    ...SAMPLE_ENTRY,
    createdAt: SAMPLE_NOW.getTime() - 2 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000003",
    summary: 'Agente "Redator" contratado.',
    type: "MEMBER_HIRED",
  },
  {
    ...SAMPLE_ENTRY,
    companyName: "Loja Nova",
    createdAt: SAMPLE_NOW.getTime() - 5 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000004",
    summary: "Convite enviado para contato@lojanova.com.br.",
    type: "CUSTOMER_INVITED",
  },
  {
    ...SAMPLE_ENTRY,
    createdAt: SAMPLE_NOW.getTime() - 26 * 60 * 60_000,
    id: "00000000-0000-4000-8000-000000000005",
    summary: "Time confirmado pelo cliente.",
    type: "TEAM_CONFIRMED",
  },
];

const SAMPLE_FEED = (
  <ActivityFeedCard category={undefined} items={SAMPLE_ACTIVITY} now={SAMPLE_NOW} />
);

const ActivityContent = async ({ searchParams }: { searchParams: ActivitySearchParams }) => {
  const params = await searchParams;
  const category = ACTIVITY_CATEGORIES.find((value) => value === params.category);

  return (
    <div className="flex flex-col gap-5">
      <FilterChips active={category} />
      <SkeletonSuspense label="Carregando atividade" skeleton={SAMPLE_FEED}>
        <ActivityFeed category={category} />
      </SkeletonSuspense>
    </div>
  );
};

const ActivityPage = ({ searchParams }: { searchParams: ActivitySearchParams }) => (
  <div className="flex flex-col gap-5">
    <PageHeader description="Registro completo do operador" title="Atividade" />
    <SkeletonSuspense
      label="Carregando atividade"
      skeleton={
        <div className="flex flex-col gap-5">
          <FilterChips active={undefined} />
          {SAMPLE_FEED}
        </div>
      }
    >
      <ActivityContent searchParams={searchParams} />
    </SkeletonSuspense>
  </div>
);

export default ActivityPage;
