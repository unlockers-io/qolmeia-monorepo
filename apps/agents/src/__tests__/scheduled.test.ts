import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import cloudflare from "#/cloudflare";

describe("scheduled", () => {
  it("refuses a cron no handler owns instead of running another job", async () => {
    await expect(
      cloudflare.scheduled({ cron: "0 0 * * *", scheduledTime: 0 } as ScheduledController, env),
    ).rejects.toThrow(/No scheduled handler for cron "0 0 \* \* \*"/v);
  });
});
