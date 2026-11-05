"use client";

import Link from "next/link";
import { Skeleton } from "skullet/react";

import { AgentCard } from "@/components/agent-card";
import type { TeamMemberView } from "@/lib/team";
import { useTeamRoster } from "@/lib/use-team-roster";

const SAMPLE_TEAM: ReadonlyArray<TeamMemberView> = [
  {
    currentWork: [],
    displayName: "Correspondente",
    hasPromptOverride: false,
    id: "00000000-0000-4000-8000-000000000001",
    lifetimeDone: 0,
    role: "correspondent",
    status: "available",
    templateId: null,
    templateName: null,
    workerKind: null,
  },
  {
    currentWork: [
      {
        status: "in_progress",
        summary: "Três posts para o cardápio de verão",
        ticketId: "00000000-0000-4000-8000-000000000011",
      },
    ],
    displayName: "Designer",
    hasPromptOverride: false,
    id: "00000000-0000-4000-8000-000000000002",
    lifetimeDone: 12,
    role: "worker",
    status: "working",
    templateId: "00000000-0000-4000-8000-000000000021",
    templateName: "Designer",
    workerKind: "designer",
  },
  {
    currentWork: [],
    displayName: "Redator",
    hasPromptOverride: false,
    id: "00000000-0000-4000-8000-000000000003",
    lifetimeDone: 8,
    role: "worker",
    status: "available",
    templateId: "00000000-0000-4000-8000-000000000022",
    templateName: "Redator",
    workerKind: "copywriter",
  },
];

type TeamSidebarViewProps = {
  error: Error | null;
  members: ReadonlyArray<TeamMemberView> | null;
};

const TeamSidebarView = ({ error, members }: TeamSidebarViewProps) => (
  <aside
    aria-label="Seu time"
    className="hidden w-75 flex-col gap-2.5 border-l border-border bg-card p-4.5 lg:flex"
  >
    <h2 className="mb-0.5 text-sm font-semibold">Seu Time</h2>
    {error && <p className="text-xs text-destructive">Falha ao carregar o time: {error.message}</p>}
    <Skeleton data={members} label="Carregando o time" sample={SAMPLE_TEAM}>
      {(list) => (
        <ul className="flex flex-col gap-2.5">
          {list.map((m) => (
            <li className="rounded-panel border border-border bg-card px-3.5 py-3" key={m.id}>
              <AgentCard member={m} variant="compact" />
            </li>
          ))}
        </ul>
      )}
    </Skeleton>
    <Link
      className="mt-auto inline-flex items-center justify-center gap-1 rounded-panel border border-dashed border-input px-3 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-highlight-surface"
      href="/empresa"
    >
      + Contratar mais agentes
    </Link>
  </aside>
);

type TeamSidebarProps = {
  companyId: string;
};

const TeamSidebar = ({ companyId }: TeamSidebarProps) => {
  const { error, members, status } = useTeamRoster(companyId);

  return <TeamSidebarView error={error} members={status === "loading" ? null : members} />;
};

export { SAMPLE_TEAM, TeamSidebar, TeamSidebarView };
