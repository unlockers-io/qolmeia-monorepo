import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { generateBrandImageSkill } from "#/skills/generate-brand-image";
import type { SkillContext } from "#/skills/skill";

const COMPANY_ID = "co_img_test";
const AGENT_INSTANCE_ID = "agent_img_test";
const originalFetch = globalThis.fetch;

const RED_PIXEL_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const buildChatImageResponse = (b64: string) =>
  Response.json({
    choices: [
      {
        message: {
          content: "",
          images: [
            {
              image_url: { url: `data:image/png;base64,${b64}` },
              type: "image_url",
            },
          ],
          role: "assistant",
        },
      },
    ],
  });

const ctx: SkillContext = {
  agentInstanceId: AGENT_INSTANCE_ID,
  companyId: COMPANY_ID,
  deliverableFolder: "customer",
  get env() {
    return env;
  },
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("generateBrandImage", () => {
  it("uploads to R2, writes an asset row, returns a signed URL", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(buildChatImageResponse(RED_PIXEL_B64)));

    const result = (await generateBrandImageSkill.execute(
      { aspectRatio: "1:1", prompt: "uma onça pintada estilizada" },
      ctx,
    )) as { assetId: string; url: string };

    expect(result.assetId).toBeTruthy();
    expect(result.url).toContain("/assets/");
    expect(result.url).toContain("token=");

    const row = await db((client) =>
      client.asset.findUnique({
        select: { bytes: true, kind: true, mime: true, r2Key: true },
        where: { id: result.assetId },
      }),
    );
    expect(row?.kind).toBe("generated_image");
    expect(row?.mime).toBe("image/png");
    expect(row?.bytes).toBeGreaterThan(0);

    if (row) {
      const obj = await env.ASSETS.get(row.r2Key);
      expect(obj).not.toBeNull();
    }
  });

  it("surfaces OpenRouter HTTP errors without throwing", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("rate limit", { status: 429 })));
    const result = (await generateBrandImageSkill.execute({ prompt: "x" }, ctx)) as {
      error: string;
    };
    expect(result.error).toContain("429");
  });

  it("returns an error when the response has no image content", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          choices: [{ message: { content: "no image here", images: [], role: "assistant" } }],
        }),
      ),
    );
    const result = (await generateBrandImageSkill.execute({ prompt: "x" }, ctx)) as {
      error: string;
    };
    expect(result.error).toContain("image_url");
  });

  it("dedups on (company_id, sha256) — same bytes return the same asset id", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(buildChatImageResponse(RED_PIXEL_B64)));
    const first = (await generateBrandImageSkill.execute({ prompt: "a" }, ctx)) as {
      assetId: string;
    };
    const second = (await generateBrandImageSkill.execute({ prompt: "b" }, ctx)) as {
      assetId: string;
    };
    expect(second.assetId).toBe(first.assetId);
  });

  it("keeps a Worker job's image in the agent folder until its Action executes", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(buildChatImageResponse(RED_PIXEL_B64)));
    const result = (await generateBrandImageSkill.execute(
      { prompt: "rascunho" },
      { ...ctx, deliverableFolder: "agent" },
    )) as { assetId: string; deliverable: boolean };

    expect(result.deliverable).toBe(true);
    const row = await db((client) =>
      client.asset.findUniqueOrThrow({
        select: { r2Key: true, visibility: true },
        where: { id: result.assetId },
      }),
    );
    expect(row.visibility).toBe("agent");
    expect(row.r2Key).toMatch(new RegExp(`^org_${COMPANY_ID}/agent/`, "v"));
  });
});
