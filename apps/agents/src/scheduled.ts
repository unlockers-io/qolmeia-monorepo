import { withDb } from "#/lib/db";
import { publishPendingFacts } from "#/memory/memory";
import { runProactiveSweep } from "#/proactive/proactive";

type ScheduledHandler = (env: Env, scheduledTime: number) => Promise<void>;

const SCHEDULES = new Map<string, ScheduledHandler>([
  [
    "* * * * *",
    async (env) => {
      await withDb(env, (db) => publishPendingFacts(env, db));
    },
  ],
  [
    "0 13 * * 1",
    async (env, scheduledTime) => {
      await runProactiveSweep(env, scheduledTime);
    },
  ],
]);

const runScheduled = async (controller: ScheduledController, env: Env): Promise<void> => {
  const handler = SCHEDULES.get(controller.cron);

  if (handler === undefined) {
    throw new Error(`No scheduled handler for cron "${controller.cron}"`);
  }

  await handler(env, controller.scheduledTime);
};

const SCHEDULED_CRONS: ReadonlyArray<string> = [...SCHEDULES.keys()];

export { runScheduled, SCHEDULED_CRONS };
