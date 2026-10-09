import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as TeamModule from "@/lib/team";

type JsonBody =
  | boolean
  | number
  | string
  | null
  | ReadonlyArray<JsonBody>
  | { readonly [key: string]: JsonBody | undefined };

const ORG_ID = "co_1";

const okJson = (body: JsonBody): Response =>
  ({ json: () => Promise.resolve(body), ok: true, status: 200 }) as unknown as Response;

const errorResponse = (status: number): Response =>
  ({
    json: () => Promise.resolve({}),
    ok: false,
    status,
    text: () => Promise.resolve(""),
  }) as unknown as Response;

const ME = okJson({ currentOrg: { id: ORG_ID, role: "CUSTOMER" }, orgs: [] });

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchLike>>;
let team: typeof TeamModule;

const respondWith = (responses: Record<string, Response>): void => {
  fetchMock.mockImplementation((url: string) => {
    const response = responses[url];
    if (response === undefined) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return Promise.resolve(response);
  });
};

const expectCall = (
  url: string,
  expected: { body?: string; method: string; orgId?: string },
): void => {
  const call = fetchMock.mock.calls.findLast(([calledUrl]) => calledUrl === url);
  expect(call).toBeDefined();
  const init = call?.[1];
  expect(init).toMatchObject({ credentials: "include", method: expected.method });
  expect(init?.body).toBe(expected.body);
  const headers = new Headers(init?.headers);
  expect(headers.get("x-org-id")).toBe(expected.orgId ?? ORG_ID);
  expect(headers.get("content-type")).toBe(expected.body === undefined ? null : "application/json");
};

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn<FetchLike>();
  vi.stubGlobal("fetch", fetchMock);
  team = await import("@/lib/team");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("org discovery", () => {
  it("names the org on every call after learning it once from /api/me", async () => {
    respondWith({ "/api/me": ME, "/api/me/team": okJson({ members: [] }) });

    await team.fetchTeam();
    await team.fetchTeam();

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/me")).toHaveLength(1);
    expectCall("/api/me/team", { method: "GET" });
  });

  it("falls back to the first CUSTOMER org when no org is current", async () => {
    respondWith({
      "/api/me": okJson({
        currentOrg: null,
        orgs: [
          { id: "co_staff", role: "STAFF" },
          { id: "co_customer", role: "CUSTOMER" },
        ],
      }),
      "/api/me/team": okJson({ members: [] }),
    });

    await team.fetchTeam();

    expectCall("/api/me/team", { method: "GET", orgId: "co_customer" });
  });

  it("surfaces a failed discovery instead of calling on with no org", async () => {
    respondWith({ "/api/me": errorResponse(502) });

    await expect(team.fetchTeam()).rejects.toMatchObject({ name: "ApiError", status: 502 });
  });
});

describe("fetchTeam", () => {
  it("GETs /api/me/team with credentials and returns members", async () => {
    const members = [{ id: "m1" }];
    respondWith({ "/api/me": ME, "/api/me/team": okJson({ members }) });

    const result = await team.fetchTeam();

    expectCall("/api/me/team", { method: "GET" });
    expect(result).toBe(members);
  });

  it("throws an ApiError carrying the status on failure", async () => {
    respondWith({ "/api/me": ME, "/api/me/team": errorResponse(503) });
    await expect(team.fetchTeam()).rejects.toMatchObject({ name: "ApiError", status: 503 });
  });
});

describe("fetchCatalogue", () => {
  it("GETs /api/me/catalogue with credentials and returns templates", async () => {
    const templates = [{ id: "t1" }];
    respondWith({ "/api/me": ME, "/api/me/catalogue": okJson({ templates }) });

    const result = await team.fetchCatalogue();

    expectCall("/api/me/catalogue", { method: "GET" });
    expect(result).toBe(templates);
  });

  it("throws on failure", async () => {
    respondWith({ "/api/me": ME, "/api/me/catalogue": errorResponse(500) });
    await expect(team.fetchCatalogue()).rejects.toMatchObject({ name: "ApiError", status: 500 });
  });
});

describe("hireMember", () => {
  it("POSTs the input as JSON and returns the member", async () => {
    const member = { id: "m2" };
    respondWith({ "/api/me": ME, "/api/me/team/hire": okJson({ member }) });

    const result = await team.hireMember({ displayName: "Ana", templateId: "tpl-1" });

    expectCall("/api/me/team/hire", {
      body: JSON.stringify({ displayName: "Ana", templateId: "tpl-1" }),
      method: "POST",
    });
    expect(result).toBe(member);
  });

  it("throws on failure", async () => {
    respondWith({ "/api/me": ME, "/api/me/team/hire": errorResponse(400) });
    await expect(team.hireMember({ templateId: "tpl-1" })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
    });
  });
});

describe("patchMember", () => {
  it("PATCHes the member path as JSON and returns the member", async () => {
    const member = { id: "m3" };
    respondWith({ "/api/me": ME, "/api/me/team/members/m3": okJson({ member }) });

    const result = await team.patchMember("m3", { displayName: "Novo nome" });

    expectCall("/api/me/team/members/m3", {
      body: JSON.stringify({ displayName: "Novo nome" }),
      method: "PATCH",
    });
    expect(result).toBe(member);
  });

  it("throws an ApiError carrying the status on failure", async () => {
    respondWith({ "/api/me": ME, "/api/me/team/members/m3": errorResponse(404) });
    await expect(team.patchMember("m3", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });
});

describe("setPaused", () => {
  it("POSTs to the pause path when paused is true", async () => {
    const member = { id: "m4" };
    respondWith({ "/api/me": ME, "/api/me/team/members/m4/pause": okJson({ member }) });

    const result = await team.setPaused("m4", true);

    expectCall("/api/me/team/members/m4/pause", { method: "POST" });
    expect(result).toBe(member);
  });

  it("POSTs to the resume path when paused is false", async () => {
    respondWith({
      "/api/me": ME,
      "/api/me/team/members/m4/resume": okJson({ member: { id: "m4" } }),
    });

    await team.setPaused("m4", false);

    expectCall("/api/me/team/members/m4/resume", { method: "POST" });
  });

  it("throws on failure", async () => {
    respondWith({ "/api/me": ME, "/api/me/team/members/m4/pause": errorResponse(400) });
    await expect(team.setPaused("m4", true)).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
    });
  });
});
