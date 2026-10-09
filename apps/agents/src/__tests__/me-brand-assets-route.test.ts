import { beforeEach, describe, expect, it } from "vitest";

import { seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs, type Persona } from "#/__tests__/sign-in";

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
    const body = await res.json<{ assetId: string; category: string }>();
    expect(body.category).toBe("logo");
    expect(body.assetId).toBeTruthy();
  });

  it("falls back to 'other' for an unknown category", async () => {
    cookie = await signInAs(meCustomer);
    const res = await fetchWithCookie(cookie, "https://agents.test/api/me/brand-assets", {
      body: uploadForm("bogus"),
      method: "POST",
    });
    const body = await res.json<{ category: string }>();
    expect(body.category).toBe("other");
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
    const { assetId } = await created.json<{ assetId: string }>();

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
