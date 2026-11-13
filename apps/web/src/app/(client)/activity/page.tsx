import { apiGetServer } from "@repo/app-shell/server-api";
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageContainer } from "@repo/ui/compositions/page-container";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { cn } from "@repo/ui/lib/utils";
import {
  type ActivityCategory,
  activityCategoryOf,
  type CustomerActivityEntry,
} from "@repo/worker-api/contracts";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { SkeletonSuspense } from "skullet/react";

import { SectionError } from "@/components/section-error";
import { fetchActivity } from "@/lib/activity";

export const metadata: Metadata = {
  title: "Atividade",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type Category = { dot: string; label: string };

const CATEGORY = {
  ACTION: { dot: "bg-primary", label: "Aprovação" },
  CUSTOMER: { dot: "bg-warning", label: "Cliente" },
  MEMBER: { dot: "bg-muted-foreground", label: "Agente" },
  TEAM: { dot: "bg-success", label: "Time" },
  TICKET: { dot: "bg-info", label: "Pedido" },
  WORKER: { dot: "bg-worker-surface-foreground", label: "Especialista" },
} satisfies Record<ActivityCategory, Category>;

const OTHER: Category = { dot: "bg-muted-foreground", label: "Atividade" };

const categoryOf = (type: string): Category => {
  const category = activityCategoryOf(type);

  return category === null ? OTHER : CATEGORY[category];
};

const DAY = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dayLabel = (date: Date, now: Date): string => {
  const key = DAY_KEY.format(date);

  if (key === DAY_KEY.format(now)) {
    return "Hoje";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  return key === DAY_KEY.format(yesterday) ? "Ontem" : DAY.format(date);
};

type DayGroup = { label: string; rows: ReadonlyArray<CustomerActivityEntry> };

const groupByDay = (rows: ReadonlyArray<CustomerActivityEntry>): ReadonlyArray<DayGroup> => {
  const now = new Date();
  const groups = new Map<string, Array<CustomerActivityEntry>>();

  for (const row of rows) {
    const label = dayLabel(new Date(row.createdAt), now);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }

  return [...groups].map(([label, items]) => ({ label, rows: items }));
};

const ActivityFeed = ({ groups }: { groups: ReadonlyArray<DayGroup> }) => (
  <div className="flex flex-col gap-6">
    {groups.map((group) => (
      <section aria-label={group.label} className="flex flex-col gap-2" key={group.label}>
        <h2 className="text-sm font-semibold text-muted-foreground">{group.label}</h2>
        <Card>
          <CardContent className="px-0">
            <ul className="flex flex-col">
              {group.rows.map((row) => {
                const category = categoryOf(row.type);

                return (
                  <li
                    className="flex gap-3 border-b border-border px-6 py-3.5 last:border-b-0"
                    key={row.id}
                  >
                    <span
                      aria-hidden
                      className={cn("mt-1.5 size-2 shrink-0 rounded-full", category.dot)}
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-sm leading-relaxed text-foreground">{row.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.label} ·{" "}
                        <time dateTime={new Date(row.createdAt).toISOString()}>
                          {TIME.format(new Date(row.createdAt))}
                        </time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>
    ))}
  </div>
);

const ActivityContent = async () => {
  const rows = await fetchActivity(apiGetServer);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            description="Quando o seu Time começar a trabalhar, os eventos aparecem aqui."
            icon={<Activity aria-hidden />}
            title="Nenhuma atividade ainda"
          />
        </CardContent>
      </Card>
    );
  }

  return <ActivityFeed groups={groupByDay(rows)} />;
};

const SAMPLE_GROUPS: ReadonlyArray<DayGroup> = [
  {
    label: "Hoje",
    rows: [
      {
        createdAt: Date.parse("2026-01-01T14:32:00.000Z"),
        id: "sample-1",
        summary: "Designer entregou 3 opções de post para o lançamento da coleção de verão",
        type: "WORKER_DELIVERABLE_READY",
      },
      {
        createdAt: Date.parse("2026-01-01T13:05:00.000Z"),
        id: "sample-2",
        summary: "Pedido aberto: carrossel para o Instagram",
        type: "TICKET_CREATED",
      },
      {
        createdAt: Date.parse("2026-01-01T11:48:00.000Z"),
        id: "sample-3",
        summary: "Entrega aprovada pela equipe Qolmeia",
        type: "ACTION_APPROVED",
      },
    ],
  },
];

const ActivityPage = () => (
  <PageContainer>
    <PageHeader
      description="O que o seu Time fez: pedidos, entregas, aprovações e mudanças na equipe."
      title="Atividade"
    />
    <SectionError framed what="a atividade">
      <SkeletonSuspense
        label="Carregando atividade"
        skeleton={<ActivityFeed groups={SAMPLE_GROUPS} />}
      >
        <ActivityContent />
      </SkeletonSuspense>
    </SectionError>
  </PageContainer>
);

export default ActivityPage;
