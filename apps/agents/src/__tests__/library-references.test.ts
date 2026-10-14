import type { AssetKind, AssetVisibility } from "@repo/db/worker";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signIn, signInAs } from "#/__tests__/sign-in";
import { ACTION_TYPE_MODULES } from "#/action/action-types";
import { assetReference, storeAsset } from "#/library/assets";
import { generateBrandImageSkill } from "#/skills/generate-brand-image";

const COMPANY_ID = "co_asset_references";
const DAY_MS = 86_400_000;
const originalFetch = globalThis.fetch;

const RED_PIXEL_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const QOLMEIA_ORG_ID = "co_qolmeia";

const customer = () => signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
const operator = () => signInAs({ orgId: QOLMEIA_ORG_ID, role: "STAFF" });
const stranger = () => signInAs({ orgId: "co_someone_else", role: "CUSTOMER" });

const imageResponse = () =>
  Response.json({
    choices: [
      {
        message: {
          images: [{ image_url: { url: `data:image/png;base64,${RED_PIXEL_B64}` } }],
          role: "assistant",
        },
      },
    ],
  });

const fakeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
  Promise.resolve(
    new Request(input, init).url.endsWith("/chat/completions")
      ? imageResponse()
      : new Response("unexpected request", { status: 500 }),
  );

const store = (input: {
  kind: AssetKind;
  mime: string;
  text: string;
  visibility: AssetVisibility;
}) =>
  db((client) =>
    storeAsset(env, client, {
      bytes: new TextEncoder().encode(input.text),
      companyId: COMPANY_ID,
      kind: input.kind,
      metadata: {},
      mime: input.mime,
      visibility: input.visibility,
    }),
  );

const get = (reference: string, cookie = "") =>
  fetchWithCookie(cookie, `https://agents.test${reference}`);

beforeEach(async () => {
  globalThis.fetch = vi.fn(fakeFetch);
  await seedCompany({ id: COMPANY_ID });
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe("persisted asset references", () => {
  it("writes stable references, never expiring URLs, into deliverables and posts", async () => {
    const generated = await generateBrandImageSkill.execute(
      { prompt: "arte da padaria" },
      { agentInstanceId: "agent-ref", companyId: COMPANY_ID, deliverableFolder: "agent", env },
    );
    if ("error" in generated) {
      throw new Error(generated.error);
    }
    const reference = assetReference(generated.assetId);
    expect(generated.url).toBe(`/assets/${generated.assetId}`);

    const output = { json: JSON.stringify(generated), tool: generateBrandImageSkill.id };
    const delivered = await ACTION_TYPE_MODULES.worker_deliverable.execute(
      { companyId: COMPANY_ID, env },
      ACTION_TYPE_MODULES.worker_deliverable.propose({
        outputs: [output],
        summary: "Arte pronta.",
      }),
    );
    const posted = await ACTION_TYPE_MODULES.publish_post.execute(
      { companyId: COMPANY_ID, env },
      {
        assetIds: [generated.assetId],
        draft: {
          body: "Pão quentinho",
          callToAction: "Visite-nos",
          platform: "instagram",
          tone: "acolhedor",
        },
        summary: "Post pronto.",
      },
    );

    expect(delivered).toBe(`Arte pronta.\n\n![](${reference})`);
    expect(posted).toBe(
      `**Post para Instagram**\n\nPão quentinho\n\nVisite-nos\n\n![](${reference})`,
    );
  });

  it("still resolves a reference after the old 7-day signing window", async () => {
    const { assetId } = await store({
      kind: "generated_image",
      mime: "image/png",
      text: "png",
      visibility: "customer",
    });
    vi.useFakeTimers({ now: Date.now() + 8 * DAY_MS, toFake: ["Date"] });
    const cookie = await customer();

    const res = await get(assetReference(assetId), cookie);

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("png");
  });
});

describe("GET /assets/:id", () => {
  it("requires a session", async () => {
    const { assetId } = await store({
      kind: "generated_image",
      mime: "image/png",
      text: "png",
      visibility: "customer",
    });
    const res = await get(assetReference(assetId));
    expect(res.status).toBe(401);
  });

  it("serves a Customer their own customer folder and nothing else", async () => {
    const delivered = await store({
      kind: "generated_image",
      mime: "image/png",
      text: "entrega",
      visibility: "customer",
    });
    const scratch = await store({
      kind: "knowledge_doc",
      mime: "text/markdown",
      text: "rascunho",
      visibility: "agent",
    });

    const own = await get(assetReference(delivered.assetId), await customer());
    const agentFolder = await get(assetReference(scratch.assetId), await customer());
    const otherCompany = await get(assetReference(delivered.assetId), await stranger());

    expect(own.status).toBe(200);
    expect(agentFolder.status).toBe(404);
    expect(otherCompany.status).toBe(404);
  });

  it("serves an Operator any Company's folders", async () => {
    const scratch = await store({
      kind: "knowledge_doc",
      mime: "text/markdown",
      text: "rascunho",
      visibility: "agent",
    });

    const res = await get(assetReference(scratch.assetId), await operator());

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("rascunho");
  });

  it("serves an account on both surfaces with its Operator scope", async () => {
    const scratch = await store({
      kind: "knowledge_doc",
      mime: "text/markdown",
      text: "rascunho",
      visibility: "agent",
    });
    const cookie = await signIn([
      { orgId: COMPANY_ID, role: "CUSTOMER" },
      { orgId: QOLMEIA_ORG_ID, role: "STAFF" },
    ]);

    const res = await get(assetReference(scratch.assetId), cookie);

    expect(res.status).toBe(200);
  });

  it("refuses a signed-in account with no membership", async () => {
    const { assetId } = await store({
      kind: "generated_image",
      mime: "image/png",
      text: "png",
      visibility: "customer",
    });

    const res = await get(assetReference(assetId), await signIn([]));

    expect(res.status).toBe(403);
  });

  it("sandboxes SVG and marks every asset nosniff", async () => {
    const svg = await store({
      kind: "brand_asset",
      mime: "image/svg+xml",
      text: "<svg xmlns='http://www.w3.org/2000/svg'/>",
      visibility: "customer",
    });
    const png = await store({
      kind: "brand_asset",
      mime: "image/png",
      text: "png",
      visibility: "customer",
    });

    const cookie = await customer();
    const svgRes = await get(assetReference(svg.assetId), cookie);
    const pngRes = await get(assetReference(png.assetId), cookie);

    expect(svgRes.headers.get("content-type")).toBe("image/svg+xml");
    expect(svgRes.headers.get("content-security-policy")).toContain("sandbox");
    expect(pngRes.headers.get("content-security-policy")).toBeNull();
    expect(pngRes.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
