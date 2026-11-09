import { apiGetServer } from "@repo/app-shell/server-api";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { cn } from "@repo/ui/lib/utils";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@repo/worker-api/contracts";
import { Activity } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

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

const ActivityFeed = async ({ category }: { category: ActivityCategory | undefined }) => {
  const res = await getActivity(apiGetServer, { category, limit: ACTIVITY_PAGE_SIZE });

  return (
    <Card>
      <CardContent className="px-0">
        {res.items.length === 0 ? (
          <EmptyState
            description={
              category === undefined
                ? "Quando os agentes começarem a trabalhar, os eventos aparecem aqui."
                : `Nenhum evento em ${CATEGORY_STYLE[category].label.toLocaleLowerCase("pt-BR")} ainda.`
            }
            icon={<Activity aria-hidden />}
            title="Nenhum evento ainda"
          />
        ) : (
          <ActivityList
            category={category}
            initial={res.items}
            key={`${category ?? "all"}-${res.items[0]?.id ?? "empty"}`}
          />
        )}
      </CardContent>
    </Card>
  );
};

const FeedSkeleton = () => (
  <Card aria-hidden>
    <CardContent className="flex flex-col gap-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </CardContent>
  </Card>
);

const ActivityContent = async ({ searchParams }: { searchParams: ActivitySearchParams }) => {
  const params = await searchParams;
  const category = ACTIVITY_CATEGORIES.find((value) => value === params.category);

  return (
    <>
      <FilterChips active={category} />
      <Suspense fallback={<FeedSkeleton />}>
        <ActivityFeed category={category} />
      </Suspense>
    </>
  );
};

const ChipsSkeleton = () => (
  <div aria-hidden className="flex flex-wrap gap-2">
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton className="h-8 w-20 rounded-full" key={index} />
    ))}
  </div>
);

const ActivitySkeleton = () => (
  <>
    <ChipsSkeleton />
    <FeedSkeleton />
  </>
);

const ActivityPage = ({ searchParams }: { searchParams: ActivitySearchParams }) => (
  <div className="flex flex-col gap-5">
    <PageHeader description="Registro completo do operador" title="Atividade" />
    <Suspense fallback={<ActivitySkeleton />}>
      <ActivityContent searchParams={searchParams} />
    </Suspense>
  </div>
);

export default ActivityPage;
