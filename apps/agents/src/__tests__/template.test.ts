import { describe, expect, it } from "vitest";

import { db } from "#/__tests__/fixtures";
import { getTemplate } from "#/template/template";

describe("getTemplate", () => {
  it("reads the seeded Designer template", async () => {
    const t = await db((client) => getTemplate(client, "tpl-designer"));
    expect(t?.workerKind).toBe("designer");
    expect(t?.skillIds).toContain("generateBrandImage");
    expect(t?.defaultActionType).toBe("worker_deliverable");
    expect(t?.defaultPolicies).toEqual({});
  });
});
