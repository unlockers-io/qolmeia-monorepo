"use client";

import type { TeamMemberView } from "@repo/worker-api/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@/lib/query-keys";
import { fetchTeam, subscribeTeamEvents } from "@/lib/team";

const POLL_INTERVAL_MS = 30_000;

type RosterStatus = "error" | "loading" | "ready";

type UseTeamRosterResult = {
  error: Error | null;
  members: ReadonlyArray<TeamMemberView>;
  refetch: () => Promise<void>;
  status: RosterStatus;
};

type TeamRosterDependencies = {
  fetchRoster: typeof fetchTeam;
  subscribeToTeamEvents: typeof subscribeTeamEvents;
};

const rosterStatus = (query: { isError: boolean; isPending: boolean }): RosterStatus => {
  if (query.isPending) {
    return "loading";
  }

  if (query.isError) {
    return "error";
  }

  return "ready";
};

const createUseTeamRoster = ({ fetchRoster, subscribeToTeamEvents }: TeamRosterDependencies) => {
  const useTeamRosterWithDependencies = (
    companyId: string,
    initialData?: ReadonlyArray<TeamMemberView>,
  ): UseTeamRosterResult => {
    const queryClient = useQueryClient();

    const {
      data,
      error,
      isError,
      isPending,
      refetch: queryRefetch,
    } = useQuery({
      initialData,
      meta: { errorToast: "Falha ao sincronizar time" },
      queryFn: () => fetchRoster(),
      queryKey: queryKeys.team(companyId),
      refetchInterval: POLL_INTERVAL_MS,
      refetchOnMount: initialData === undefined,
      refetchOnWindowFocus: true,
      staleTime: 0,
    });

    useEffect(() => {
      const unsubscribe = subscribeToTeamEvents(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.team(companyId) });
      });

      return () => {
        unsubscribe?.();
      };
    }, [companyId, queryClient]);

    const refetch = async (): Promise<void> => {
      await queryRefetch();
    };

    return {
      error,
      members: data ?? [],
      refetch,
      status: rosterStatus({ isError, isPending }),
    };
  };

  return useTeamRosterWithDependencies;
};

const useTeamRoster = createUseTeamRoster({
  fetchRoster: fetchTeam,
  subscribeToTeamEvents: subscribeTeamEvents,
});

export { createUseTeamRoster, useTeamRoster };
