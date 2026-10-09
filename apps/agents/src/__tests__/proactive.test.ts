import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import {
  lastProactiveSuggestionAt,
  PROACTIVE_INTERVAL_MS,
  proactiveGate,
  recordProactiveSuggestion,
} from "#/lib/proactive";
import { runProactiveSweep } from "#/scheduled";

const COMPANY_ID = "co_proactive_test";

describe("proactiveGate", () => {
  const now = 1_000_000_000_000;

  it("skips when the brief is incomplete", () => {
    const gate = proactiveGate({ isComplete: false, lastSuggestedAt: null, now });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("brief incomplete");
  });

  it("skips when suggested within the weekly window", () => {
    const gate = proactiveGate({
      isComplete: true,
      lastSuggestedAt: now - (PROACTIVE_INTERVAL_MS - 1000),
      now,
    });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("suggested recently");
  });

  it("allows when complete and never suggested", () => {
    expect(proactiveGate({ isComplete: true, lastSuggestedAt: null, now }).ok).toBe(true);
  });

  it("allows again once the weekly window has passed", () => {
    const gate = proactiveGate({
      isComplete: true,
      lastSuggestedAt: now - (PROACTIVE_INTERVAL_MS + 1000),
      now,
    });
    expect(gate.ok).toBe(true);
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
    const result = await runProactiveSweep(env);
    expect(result).toEqual({ errored: 0, skipped: 0, suggested: 0 });
  });
});
