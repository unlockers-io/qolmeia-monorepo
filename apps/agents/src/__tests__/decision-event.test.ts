import { describe, expect, it } from "vitest";

import { decisionEventType } from "#/jobs/decision-event";

describe("decisionEventType", () => {
  it("only uses characters Cloudflare Workflows accepts in an event type", () => {
    expect(decisionEventType("7aca70eb-6b4b-42ba-a2c9-cce1f0484bac")).toMatch(/^\w[\w\-]*$/v);
  });
});
