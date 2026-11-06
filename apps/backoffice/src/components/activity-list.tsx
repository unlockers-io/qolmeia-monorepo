"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { apiGet, describeRequestError } from "@repo/worker-api";
import type { ActivityCategory, ActivityEntry } from "@repo/worker-api/contracts";
import { useState } from "react";
import { toast } from "sonner";

import { ActivityRow } from "@/components/activity-row";
import { ACTIVITY_PAGE_SIZE, getActivity } from "@/lib/backoffice-api";

type ActivityListProps = {
  category: ActivityCategory | undefined;
  initial: ReadonlyArray<ActivityEntry>;
};

const ActivityList = ({ category, initial }: ActivityListProps) => {
  const [fetched, setFetched] = useState<ReadonlyArray<ActivityEntry>>([]);
  const [fetchExhausted, setFetchExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const ready = useClientReady();

  const seen = new Set(initial.map((item) => item.id));
  const rows = [...initial, ...fetched.filter((item) => !seen.has(item.id))];
  const exhausted = fetchExhausted || initial.length < ACTIVITY_PAGE_SIZE;

  const handleLoadMore = async () => {
    if (exhausted || loading) {
      return;
    }

    setLoading(true);

    try {
      const next = await getActivity(apiGet, {
        before: rows.at(-1)?.createdAt,
        category,
        limit: ACTIVITY_PAGE_SIZE,
      });

      const fresh = next.items.filter((item) => !rows.some((existing) => existing.id === item.id));
      setFetched((prev) => [...prev, ...fresh]);

      if (fresh.length < ACTIVITY_PAGE_SIZE) {
        setFetchExhausted(true);
      }
    } catch (error) {
      toast.error(describeRequestError(error, "Não foi possível carregar mais eventos."));
    }

    setLoading(false);
  };

  return (
    <>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <ActivityRow key={row.id} row={row} />
        ))}
      </ul>
      {!exhausted && (
        <div className="flex justify-center px-5 pt-4 pb-2">
          <Button
            disabled={!ready || loading}
            onClick={() => {
              void handleLoadMore();
            }}
            type="button"
            variant="outline"
          >
            {loading ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}
    </>
  );
};

export { ActivityList };
