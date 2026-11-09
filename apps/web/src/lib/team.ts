import { apiGet, apiSend } from "@repo/worker-api";
import {
  type CatalogueResponse,
  type ConfirmTeamResponse,
  type confirmTeamInputSchema,
  type HireableTemplate,
  type hireInputSchema,
  type MemberDetailResponse,
  type MemberResponse,
  type memberPatchSchema,
  TEAM_EVENT_TYPES,
  type TeamMemberDetailView,
  type TeamMemberView,
  type TeamResponse,
} from "@repo/worker-api/contracts";
import type { z } from "zod";

const fetchTeam = async (get: typeof apiGet = apiGet): Promise<ReadonlyArray<TeamMemberView>> => {
  const { members } = await get<TeamResponse>("/api/me/team");

  return members;
};

type SharedTeamEvents = {
  failedAttempts: number;
  listeners: Set<() => void>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  source: EventSource | null;
};

const sharedTeamEvents: SharedTeamEvents = {
  failedAttempts: 0,
  listeners: new Set(),
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

const openSharedSource = (): void => {
  if (typeof EventSource === "undefined" || sharedTeamEvents.source) {
    return;
  }

  const source = new EventSource("/api/me/team/events", { withCredentials: true });
  sharedTeamEvents.source = source;
  source.addEventListener("open", () => {
    sharedTeamEvents.failedAttempts = 0;
  });

  for (const type of TEAM_EVENT_TYPES) {
    source.addEventListener(type, notifyTeamEventListeners);
  }

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
      openSharedSource();
    }, delay);
  });
};

const subscribeTeamEvents = (onEvent: () => void): (() => void) | null => {
  if (typeof EventSource === "undefined") {
    return null;
  }

  sharedTeamEvents.listeners.add(onEvent);
  openSharedSource();

  return () => {
    sharedTeamEvents.listeners.delete(onEvent);

    if (sharedTeamEvents.listeners.size === 0) {
      closeSharedSource();
    }
  };
};

const fetchCatalogue = async (
  get: typeof apiGet = apiGet,
): Promise<ReadonlyArray<HireableTemplate>> => {
  const { templates } = await get<CatalogueResponse>("/api/me/catalogue");

  return templates;
};

const confirmTeam = (input: z.input<typeof confirmTeamInputSchema>): Promise<ConfirmTeamResponse> =>
  apiSend<ConfirmTeamResponse>("POST", "/api/me/team/confirm", input);

const hireMember = async (input: z.input<typeof hireInputSchema>): Promise<TeamMemberView> => {
  const { member } = await apiSend<MemberResponse>("POST", "/api/me/team/hire", input);

  return member;
};

const patchMember = async (
  id: string,
  patch: z.input<typeof memberPatchSchema>,
): Promise<TeamMemberView> => {
  const { member } = await apiSend<MemberResponse>("PATCH", `/api/me/team/members/${id}`, patch);

  return member;
};

const fetchMemberDetail = async (id: string): Promise<TeamMemberDetailView> => {
  const { member } = await apiGet<MemberDetailResponse>(`/api/me/team/members/${id}`);

  return member;
};

const setPaused = async (id: string, paused: boolean): Promise<TeamMemberView> => {
  const { member } = await apiSend<MemberResponse>(
    "POST",
    `/api/me/team/members/${id}/${paused ? "pause" : "resume"}`,
  );

  return member;
};

export {
  confirmTeam,
  fetchCatalogue,
  fetchMemberDetail,
  fetchTeam,
  hireMember,
  patchMember,
  setPaused,
  subscribeTeamEvents,
};
