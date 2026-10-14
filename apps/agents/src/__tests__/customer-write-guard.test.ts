import { describe, expect, it } from "vitest";

import { fetchWithCookie, signInAs } from "#/__tests__/sign-in";

const COMPANY_ID = "co_write_guard_test";

type CustomerRoute = { body?: BodyInit; method: string; path: string };

const CUSTOMER_ROUTES: Array<CustomerRoute> = [
  { method: "GET", path: "/api/me/company" },
  { body: JSON.stringify({}), method: "PATCH", path: "/api/me/company" },
  {
    body: JSON.stringify({ templateId: "tpl-designer" }),
    method: "POST",
    path: "/api/me/team/hire",
  },
  { body: JSON.stringify({}), method: "PATCH", path: "/api/me/team/members/ai_1" },
  { method: "POST", path: "/api/me/team/members/ai_1/pause" },
  { method: "POST", path: "/api/me/team/members/ai_1/resume" },
  { body: new FormData(), method: "POST", path: "/api/me/uploads" },
  { body: new FormData(), method: "POST", path: "/api/me/brand-assets" },
  { method: "DELETE", path: "/api/me/brand-assets/asset_1" },
  { body: JSON.stringify({ ids: ["asset_1"] }), method: "POST", path: "/api/me/assets/delete" },
  {
    body: JSON.stringify({ templateIds: ["tpl-designer"] }),
    method: "POST",
    path: `/api/teams/${COMPANY_ID}/confirm`,
  },
];

const statusOf = async (cookie: string, route: CustomerRoute): Promise<number> => {
  const res = await fetchWithCookie(cookie, `https://agents.test${route.path}`, {
    body: route.body,
    method: route.method,
  });
  return res.status;
};

describe("customer surface guard", () => {
  it.each(CUSTOMER_ROUTES)("refuses an Operator on $method $path", async (route) => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "STAFF" });
    expect(await statusOf(cookie, route)).toBe(403);
  });

  it.each(CUSTOMER_ROUTES)(
    "asks a signed-out caller to sign in on $method $path",
    async (route) => {
      expect(await statusOf("", route)).toBe(401);
    },
  );
});
