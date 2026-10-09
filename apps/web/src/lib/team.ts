import { withOrgQuery } from "@repo/worker-api";
import type {
  AgentDisplayStatus,
  HireableTemplate,
  TeamMemberDetailView,
  TeamMemberView,
} from "@repo/worker-api/contracts";

import { activeOrgId, apiGet, apiSend } from "@/lib/api-client";

const STATUS_LABEL = {
  available: "Disponível",
  awaiting_approval: "Aguardando aprovação",
  paused: "Pausado",
  working: "Trabalhando",
} satisfies Record<AgentDisplayStatus, string>;

const fetchTeam = async (): Promise<Array<TeamMemberView>> => {
  const body = await apiGet<{ members: Array<TeamMemberView> }>("/api/me/team");
  return body.members;
};

type SharedTeamEvents = {
  failedAttempts: number;
  listeners: Set<() => void>;
  opening: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  source: EventSource | null;
};

const sharedTeamEvents: SharedTeamEvents = {
  failedAttempts: 0,
  listeners: new Set(),
  opening: false,
  reconnectTimer: null,
  source: null,
};

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 60_000;

const reconnectDelay = (failedAttempts: number): number =>
  Math.min(RECONNECT_BASE_MS * 2 ** failedAttempts, RECONNECT_MAX_MS);

const notifyTeamEventListeners = (): void => {
  for (const listener of sharedTeamEvents.listeners) {
    listener();
  }
};

const closeSharedSource = (): void => {
  if (sharedTeamEvents.reconnectTimer !== null) {
    clearTimeout(sharedTeamEvents.reconnectTimer);
    sharedTeamEvents.reconnectTimer = null;
  }
  if (sharedTeamEvents.source) {
    sharedTeamEvents.source.close();
    sharedTeamEvents.source = null;
  }
};

const openSharedSource = async (): Promise<void> => {
  if (typeof EventSource === "undefined" || sharedTeamEvents.source || sharedTeamEvents.opening) {
    return;
  }
  sharedTeamEvents.opening = true;
  let orgId: string | null = null;
  try {
    orgId = await activeOrgId();
  } catch {
    // The roster query runs the same discovery and raises this to the user, so
    // the stream opens unscoped and its own error path retries the lookup.
  } finally {
    sharedTeamEvents.opening = false;
  }
  if (sharedTeamEvents.listeners.size === 0) {
    return;
  }
  const source = new EventSource(withOrgQuery("/api/me/team/events", orgId), {
    withCredentials: true,
  });
  sharedTeamEvents.source = source;
  source.addEventListener("open", () => {
    sharedTeamEvents.failedAttempts = 0;
  });
  source.addEventListener("team:roster", notifyTeamEventListeners);
  source.addEventListener("team:status", notifyTeamEventListeners);
  source.addEventListener("error", () => {
    source.close();
    if (sharedTeamEvents.source === source) {
      sharedTeamEvents.source = null;
    }
    if (sharedTeamEvents.listeners.size === 0 || sharedTeamEvents.reconnectTimer !== null) {
      return;
    }
    const delay = reconnectDelay(sharedTeamEvents.failedAttempts);
    sharedTeamEvents.failedAttempts += 1;
    sharedTeamEvents.reconnectTimer = setTimeout(() => {
      sharedTeamEvents.reconnectTimer = null;
      void openSharedSource();
    }, delay);
  });
};

const subscribeTeamEvents = (onEvent: () => void): (() => void) | null => {
  if (typeof EventSource === "undefined") {
    return null;
  }
  sharedTeamEvents.listeners.add(onEvent);
  void openSharedSource();
  return () => {
    sharedTeamEvents.listeners.delete(onEvent);
    if (sharedTeamEvents.listeners.size === 0) {
      closeSharedSource();
    }
  };
};

const fetchCatalogue = async (): Promise<Array<HireableTemplate>> => {
  const body = await apiGet<{ templates: Array<HireableTemplate> }>("/api/me/catalogue");
  return body.templates;
};

const hireMember = async (input: {
  displayName?: string;
  templateId: string;
}): Promise<TeamMemberView> => {
  const body = await apiSend<{ member: TeamMemberView }>("POST", "/api/me/team/hire", input);
  return body.member;
};

const patchMember = async (
  id: string,
  patch: { displayName?: string; promptOverride?: string | null },
): Promise<TeamMemberView> => {
  const body = await apiSend<{ member: TeamMemberView }>(
    "PATCH",
    `/api/me/team/members/${id}`,
    patch,
  );
  return body.member;
};

const fetchMemberDetail = async (id: string): Promise<TeamMemberDetailView> => {
  const body = await apiGet<{ member: TeamMemberDetailView }>(`/api/me/team/members/${id}`);
  return body.member;
};

const setPaused = async (id: string, paused: boolean): Promise<TeamMemberView> => {
  const body = await apiSend<{ member: TeamMemberView }>(
    "POST",
    `/api/me/team/members/${id}/${paused ? "pause" : "resume"}`,
  );
  return body.member;
};

export {
  fetchCatalogue,
  fetchMemberDetail,
  fetchTeam,
  hireMember,
  patchMember,
  setPaused,
  STATUS_LABEL,
  subscribeTeamEvents,
};
export type {
  AgentDisplayStatus,
  HireableTemplate,
  TeamMemberDetailView,
  TeamMemberView,
} from "@repo/worker-api/contracts";
