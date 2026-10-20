import "zod/compile";
import "#/lib/observability";

import { withDb } from "#/lib/db";
import { publishPendingFacts } from "#/memory/memory";
import { runProactiveSweep } from "#/scheduled";

export { TeamEvents } from "#/durable-objects/team-events";
export { WorkerJobWorkflow } from "#/jobs/worker-job";

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await (controller.cron === "* * * * *"
      ? withDb(env, (db) => publishPendingFacts(env, db))
      : runProactiveSweep(env));
  },
};
