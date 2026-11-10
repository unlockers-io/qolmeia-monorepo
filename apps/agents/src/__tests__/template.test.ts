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

  it("fails an unrecognised stored policy closed to require-approval", async () => {
    await db((client) =>
      client.agentTemplate.update({
        data: { defaultPolicies: { worker_deliverable: "no-such-policy" } },
        where: { id: "tpl-designer" },
      }),
    );
    const t = await db((client) => getTemplate(client, "tpl-designer"));
    expect(t?.defaultPolicies).toEqual({ worker_deliverable: "require_approval" });
  });

  it("drops a stored policy for an Action type that no longer exists", async () => {
    await db((client) =>
      client.agentTemplate.update({
        data: { defaultPolicies: { publish_post: "notify_only", retired_type: "auto_execute" } },
        where: { id: "tpl-designer" },
      }),
    );
    const t = await db((client) => getTemplate(client, "tpl-designer"));
    expect(t?.defaultPolicies).toEqual({ publish_post: "notify_only" });
  });
});
