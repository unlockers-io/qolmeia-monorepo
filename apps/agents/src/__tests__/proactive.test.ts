import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import {
  lastProactiveSuggestionAt,
  PROACTIVE_INTERVAL_MS,
  proactiveGate,
  recordProactiveSuggestion,
  runProactiveSweep,
} from "#/proactive/proactive";

const COMPANY_ID = "co_proactive_test";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe("proactiveGate", () => {
  const now = 1_000_000_000_000;

  it("skips when suggested within the window", () => {
    expect(proactiveGate(now - (PROACTIVE_INTERVAL_MS - 1000), now)).toBe(false);
  });

  it("allows when never suggested", () => {
    expect(proactiveGate(null, now)).toBe(true);
  });

  it("allows the next weekly run even when it fires a little early", () => {
    expect(proactiveGate(now - (WEEK_MS - 30_000), now)).toBe(true);
  });
});

describe("recordProactiveSuggestion", () => {
  it("writes a WORKER_PROACTIVE_SUGGESTION row the dedup query can read back", async () => {
    await seedCompany({ id: COMPANY_ID });
    await expect(db((client) => lastProactiveSuggestionAt(client, COMPANY_ID))).resolves.toBeNull();

    await db((client) => recordProactiveSuggestion(client, COMPANY_ID));

    const row = await db((client) =>
      client.activityLog.findFirst({
        select: { createdAt: true, refId: true, type: true },
        where: { companyId: COMPANY_ID, type: "WORKER_PROACTIVE_SUGGESTION" },
      }),
    );

    expect(row?.type).toBe("WORKER_PROACTIVE_SUGGESTION");
    expect(row?.refId).toBe(`corr-${COMPANY_ID}`);
    await expect(db((client) => lastProactiveSuggestionAt(client, COMPANY_ID))).resolves.toBe(
      row?.createdAt.getTime(),
    );
  });
});

describe("runProactiveSweep", () => {
  it("wakes no DOs when no active company has a complete brief", async () => {
    await seedCompany({ id: "co_proactive_a", status: "active" });
    await seedCompany({
      brief: {
        audience: "x",
        brand: { palette: "p", references: "r", voice: "v" },
        channels: ["instagram"],
        industry: "i",
        primaryGoal: "g",
      },
      id: "co_proactive_b",
      status: "onboarding",
    });
    const result = await runProactiveSweep(env, Date.now());
    expect(result).toEqual({ errored: 0, skipped: 0, suggested: 0 });
  });
});
