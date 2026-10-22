import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";
import { listAssets, readBrandReferences, storeAsset } from "#/library/assets";

const COMPANY_ID = "co_brandassets_test";

const meCustomer: Persona = { orgId: COMPANY_ID, role: "CUSTOMER", userId: "user-1" };
const meStaff: Persona = { orgId: COMPANY_ID, role: "STAFF", userId: "staff-1" };

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);

const uploadForm = (category: string): FormData => {
  const form = new FormData();
  form.append("file", new File([pngBytes], "logo.png", { type: "image/png" }));
  form.append("category", category);

  return form;
};

let cookie = "";

beforeEach(async () => {
  cookie = "";
  await seedCompany({ id: COMPANY_ID });
});

describe("POST /api/me/brand-assets", () => {
  it("stores a brand asset with its category for CUSTOMER", async () => {
    cookie = await signInAs(meCustomer);

    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
      body: uploadForm("logo"),
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = await res.json<{ asset: { category: string; id: string } }>();
    expect(body.asset.category).toBe("logo");
    expect(body.asset.id).toBeTruthy();
  });

  it("falls back to 'other' for an unknown category", async () => {
    cookie = await signInAs(meCustomer);

    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
      body: uploadForm("bogus"),
      method: "POST",
    });

    const body = await res.json<{ asset: { category: string } }>();
    expect(body.asset.category).toBe("other");
  });

  it("403 when STAFF tries to upload", async () => {
    cookie = await signInAs(meStaff);

    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
      body: uploadForm("logo"),
      method: "POST",
    });

    expect(res.status).toBe(403);
  });
});

describe("GET + DELETE /api/me/brand-assets", () => {
  it("lists then deletes a brand asset", async () => {
    cookie = await signInAs(meCustomer);

    const created = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
      body: uploadForm("post"),
      method: "POST",
    });

    const {
      asset: { id: assetId },
    } = await created.json<{ asset: { id: string } }>();

    const listRes = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets");
    const list = await listRes.json<{ items: Array<{ category: string; id: string }> }>();
    expect(list.items.some((a) => a.id === assetId && a.category === "post")).toBe(true);

    const delRes = await fetchWithCookie(
      cookie,
      `https://agents.test/api/me/brand-assets/${assetId}`,
      { method: "DELETE" },
    );

    expect(delRes.status).toBe(200);

    const afterRes = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets");
    const after = await afterRes.json<{ items: Array<{ id: string }> }>();
    expect(after.items.some((a) => a.id === assetId)).toBe(false);
  });
});

describe("brand asset identity", () => {
  it.each(["user_upload", "generated_image"] as const)(
    "keeps identical %s bytes separate from brand references",
    async (kind) => {
      const original = await db((client) =>
        storeAsset(env, client, {
          bytes: pngBytes,
          companyId: COMPANY_ID,
          kind,
          metadata: {},
          mime: "image/png",
          visibility: "customer",
        }),
      );

      cookie = await signInAs(meCustomer);

      const created = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
        body: uploadForm("logo"),
        method: "POST",
      });

      expect(created.status).toBe(200);
      const { asset } = await created.json<{ asset: { category: string; id: string } }>();
      expect(asset.id).not.toBe(original.id);
      const listed = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets");
      expect(await listed.json()).toEqual({ items: [asset] });
      const references = await db((client) => readBrandReferences(env, client, COMPANY_ID, 4));
      expect(references).toEqual([{ bytes: pngBytes, mime: "image/png" }]);

      const deleted = await fetchWithCookie(
        cookie,
        `https://agents.test/api/me/brand-assets/${asset.id}`,
        { method: "DELETE" },
      );

      expect(deleted.status).toBe(200);
      expect(await db((client) => listAssets(client, COMPANY_ID))).toMatchObject([
        { id: original.id, kind },
      ]);

      const originalRow = await db((client) =>
        client.asset.findUniqueOrThrow({ where: { id: original.id } }),
      );

      expect(await env.ASSETS.get(originalRow.r2Key)).not.toBeNull();
    },
  );

  it("returns the original same-kind metadata on a re-upload with a different category", async () => {
    cookie = await signInAs(meCustomer);

    const upload = (category: string) =>
      fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
        body: uploadForm(category),
        method: "POST",
      });

    const firstResponse = await upload("logo");
    const first = await firstResponse.json<{ asset: { category: string } }>();
    const repeatedResponse = await upload("reference");
    const repeated = await repeatedResponse.json();
    expect(first.asset.category).toBe("logo");
    expect(repeated).toEqual(first);
    const listed = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets");
    expect(await listed.json()).toEqual({ items: [first.asset] });
  });
});
