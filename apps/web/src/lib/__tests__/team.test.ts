import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as TeamModule from "@/lib/team";

type JsonBody =
  | boolean
  | number
  | string
  | null
  | ReadonlyArray<JsonBody>
  | { readonly [key: string]: JsonBody | undefined };

const okJson = (body: JsonBody): Response => Response.json(body);

const errorResponse = (status: number): Response => new Response("", { status });

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

const lastCall = () => {
  const [url, init] = fetchMock.mock.lastCall ?? [];
  const headers = new Headers(init?.headers);
  return {
    body: init?.body,
    contentType: headers.get("content-type"),
    credentials: init?.credentials,
    method: init?.method,
    orgId: headers.get("x-org-id"),
    url,
  };
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

describe("the customer surface", () => {
  it("names no org: the Worker acts in the Customer's own Company", async () => {
    respondWith({ "/api/me/team": okJson({ members: [] }) });

    await team.fetchTeam();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastCall()).toMatchObject({ credentials: "include", orgId: null });
  });
});

describe("fetchTeam", () => {
  it("GETs /api/me/team with credentials and returns members", async () => {
    const members = [{ id: "m1" }];
    respondWith({ "/api/me/team": okJson({ members }) });

    const result = await team.fetchTeam();

    expect(lastCall()).toMatchObject({ method: "GET", url: "/api/me/team" });
    expect(result).toEqual(members);
  });

  it("throws an ApiError carrying the status on failure", async () => {
    respondWith({ "/api/me/team": errorResponse(503) });
    await expect(team.fetchTeam()).rejects.toMatchObject({ name: "ApiError", status: 503 });
  });
});

describe("fetchCatalogue", () => {
  it("GETs /api/me/catalogue with credentials and returns templates", async () => {
    const templates = [{ id: "t1" }];
    respondWith({ "/api/me/catalogue": okJson({ templates }) });

    const result = await team.fetchCatalogue();

    expect(lastCall()).toMatchObject({ method: "GET", url: "/api/me/catalogue" });
    expect(result).toEqual(templates);
  });

  it("throws on failure", async () => {
    respondWith({ "/api/me/catalogue": errorResponse(500) });
    await expect(team.fetchCatalogue()).rejects.toMatchObject({ name: "ApiError", status: 500 });
  });
});

describe("hireMember", () => {
  it("POSTs the input as JSON and returns the member", async () => {
    const member = { id: "m2" };
    respondWith({ "/api/me/team/hire": okJson({ member }) });

    const result = await team.hireMember({ displayName: "Ana", templateId: "tpl-1" });

    expect(lastCall()).toMatchObject({
      body: JSON.stringify({ displayName: "Ana", templateId: "tpl-1" }),
      contentType: "application/json",
      method: "POST",
      url: "/api/me/team/hire",
    });
    expect(result).toEqual(member);
  });

  it("throws on failure", async () => {
    respondWith({ "/api/me/team/hire": errorResponse(400) });
    await expect(team.hireMember({ templateId: "tpl-1" })).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
    });
  });
});

describe("patchMember", () => {
  it("PATCHes the member path as JSON and returns the member", async () => {
    const member = { id: "m3" };
    respondWith({ "/api/me/team/members/m3": okJson({ member }) });

    const result = await team.patchMember("m3", { displayName: "Novo nome" });

    expect(lastCall()).toMatchObject({
      body: JSON.stringify({ displayName: "Novo nome" }),
      contentType: "application/json",
      method: "PATCH",
      url: "/api/me/team/members/m3",
    });
    expect(result).toEqual(member);
  });

  it("throws an ApiError carrying the status on failure", async () => {
    respondWith({ "/api/me/team/members/m3": errorResponse(404) });
    await expect(team.patchMember("m3", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });
});

describe("setPaused", () => {
  it("POSTs to the pause path when paused is true", async () => {
    const member = { id: "m4" };
    respondWith({ "/api/me/team/members/m4/pause": okJson({ member }) });

    const result = await team.setPaused("m4", true);

    expect(lastCall()).toMatchObject({ method: "POST", url: "/api/me/team/members/m4/pause" });
    expect(result).toEqual(member);
  });

  it("POSTs to the resume path when paused is false", async () => {
    respondWith({
      "/api/me/team/members/m4/resume": okJson({ member: { id: "m4" } }),
    });

    await team.setPaused("m4", false);

    expect(lastCall()).toMatchObject({ method: "POST", url: "/api/me/team/members/m4/resume" });
  });

  it("throws on failure", async () => {
    respondWith({ "/api/me/team/members/m4/pause": errorResponse(400) });
    await expect(team.setPaused("m4", true)).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
    });
  });
});
