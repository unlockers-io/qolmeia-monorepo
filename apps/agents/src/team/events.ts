import { log } from "@repo/observability";
import type { TeamEvent } from "@repo/worker-api/contracts";

type TeamEventsEnv = Pick<Env, "TEAM_EVENTS">;

const teamEventsOf = (env: TeamEventsEnv, companyId: string) =>
  env.TEAM_EVENTS.getByName(companyId);

const emitTeamEvent = async (env: TeamEventsEnv, event: TeamEvent): Promise<void> => {
  try {
    await teamEventsOf(env, event.companyId).broadcast(event);
  } catch (error) {
    log.error({
      companyId: event.companyId,
      error: error instanceof Error ? error.message : String(error),
      message: "team.event.emit.err",
      type: event.type,
    });
  }
};

const subscribeTeamEvents = (env: TeamEventsEnv, companyId: string): Promise<Response> =>
  teamEventsOf(env, companyId).subscribe();

export { emitTeamEvent, subscribeTeamEvents };

export type { TeamEventsEnv };
