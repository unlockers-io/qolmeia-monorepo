import { describe, expect, it } from "vitest";

import { actionIdFor } from "#/action/action";
import { ACTION_TYPE_MODULES, resolvePolicy } from "#/action/action-types";
import { decisionEventType } from "#/jobs/decision";

type ToolResult = Record<string, ReadonlyArray<string> | boolean | number | string>;

const output = (tool: string, value: ToolResult) => ({ json: JSON.stringify(value), tool });

const draft = (body: string) => ({
  body,
  callToAction: "Visite-nos",
  hashtags: ["cafe"],
  platform: "instagram",
  tone: "acolhedor",
});

describe("resolvePolicy", () => {
  it("returns the template's policy when the action type is pinned", () => {
    const template = {
      defaultPolicies: { publish_post: "notify_only", worker_deliverable: "require_approval" },
    };
    expect(resolvePolicy("worker_deliverable", template)).toBe("require_approval");
    expect(resolvePolicy("publish_post", template)).toBe("notify_only");
  });

  it("falls back to the action type's default policy", () => {
    const template = { defaultPolicies: { publish_asset: "require_approval" } };
    expect(resolvePolicy("worker_deliverable", template)).toBe("auto_execute");
    expect(resolvePolicy("publish_post", template)).toBe("require_approval");
  });

  it("falls back to require-approval when the template policy is malformed", () => {
    const template = { defaultPolicies: { worker_deliverable: "no-such-policy" } };
    expect(resolvePolicy("worker_deliverable", template)).toBe("require_approval");
  });
});

describe("action type proposals", () => {
  it("collects every deliverable asset and embeds generated images", () => {
    const proposed = ACTION_TYPE_MODULES.worker_deliverable.propose({
      outputs: [
        output("generateBrandImage", { assetId: "img-1", deliverable: true, url: "https://x/1" }),
        output("generateBrandImage", { assetId: "img-2", deliverable: true, url: "https://x/2" }),
        output("saveAsset", { assetId: "draft-1", deliverable: false }),
        output("rememberFact", { id: "fact-1", savedAt: 0 }),
      ],
      summary: "Veja a [arte](https://x/1).",
    });
    expect(proposed).toEqual({
      assetIds: ["img-1", "img-2"],
      summary: "Veja a ![arte](https://x/1).\n\n![](https://x/2)",
    });
  });

  it("attaches the latest social-post draft to a publish_post proposal", () => {
    const proposed = ACTION_TYPE_MODULES.publish_post.propose({
      outputs: [
        output("draftSocialPost", draft("primeira")),
        output("draftSocialPost", draft("final")),
      ],
      summary: "Post pronto.",
    });
    expect(proposed).toMatchObject({
      assetIds: [],
      draft: { body: "final" },
      summary: "Post pronto.",
    });
  });
});

describe("decisionEventType", () => {
  it("only uses characters Cloudflare Workflows accepts in an event type", () => {
    const actionId = actionIdFor("7aca70eb-6b4b-42ba-a2c9-cce1f0484bac", 2);
    expect(decisionEventType(actionId)).toMatch(/^\w[\w\-]*$/v);
  });
});
