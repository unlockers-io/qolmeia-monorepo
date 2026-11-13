import { env } from "cloudflare:workers";
import { describe, expect, inject, it } from "vitest";

import cloudflare from "#/cloudflare";
import { MEMORY_INDEX } from "#/memory/vectors";
import { SCHEDULED_CRONS } from "#/scheduled";

describe("wrangler.jsonc", () => {
  it("triggers exactly the crons that have a handler", () => {
    expect(inject("wranglerCrons").toSorted()).toEqual(SCHEDULED_CRONS.toSorted());
  });

  it("binds the memory index the reindex script rebuilds", () => {
    expect(inject("wranglerVectorIndexes")).toEqual([MEMORY_INDEX]);
  });
});

describe("scheduled", () => {
  it("refuses a cron no handler owns instead of running another job", async () => {
    await expect(
      cloudflare.scheduled({ cron: "0 0 * * *", scheduledTime: 0 } as ScheduledController, env),
    ).rejects.toThrow(/No scheduled handler for cron "0 0 \* \* \*"/v);
  });
});
