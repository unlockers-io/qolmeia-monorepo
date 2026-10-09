import { afterEach, describe, expect, it, vi } from "vitest";

import type { MeResponse, OrgRole } from "./contracts";

import { ApiError, createBrowserApi, createServerApi, handleResponse, withOrgQuery } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

type FetchCall = { init: RequestInit | undefined; url: string };

const org = (id: string, role: OrgRole) => ({ id, name: id, role, slug: id });

const meBody = (overrides: Partial<MeResponse> = {}): MeResponse => ({
  currentOrg: org("co_1", "CUSTOMER"),
  orgs: [org("co_1", "CUSTOMER")],
  role: "CUSTOMER",
  user: {
    displayName: null,
    email: "u@x.com",
    emailVerified: true,
    id: "u_1",
    image: null,
    name: "U",
    username: null,
  },
  ...overrides,
});

const stubWorker = (
  routes: Record<string, () => Response>,
  me: () => Response = () => Response.json(meBody()),
): Array<FetchCall> => {
  const calls: Array<FetchCall> = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ init, url });
    const respond = url === "/api/me" ? me : routes[url];
    if (respond === undefined) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return Promise.resolve(respond());
  });
  return calls;
};

const callTo = (calls: ReadonlyArray<FetchCall>, url: string): FetchCall => {
  const call = calls.find((candidate) => candidate.url === url);
  if (call === undefined) {
    throw new Error(`no call to ${url}`);
  }
  return call;
};

const orgHeader = (call: FetchCall): string | null =>
  new Headers(call.init?.headers).get("X-Org-Id");

describe("createBrowserApi", () => {
  it("prefixes basePath and parses JSON on apiGet", async () => {
    const calls = stubWorker({ "/api/backoffice/actions": () => Response.json({ ok: true }) });

    const api = createBrowserApi({ allow: ["STAFF"], basePath: "/api/backoffice" });
    const out = await api.apiGet<{ ok: boolean }>("/actions");

    expect(out).toEqual({ ok: true });
    expect(callTo(calls, "/api/backoffice/actions").init).toMatchObject({
      credentials: "include",
      method: "GET",
    });
  });

  it("sends the active org on every call, learning it from /api/me once", async () => {
    const calls = stubWorker({
      "/api/backoffice/actions": () => Response.json({ items: [] }),
      "/api/backoffice/actions/a_1/decide": () => Response.json({ ok: true }),
    });

    const api = createBrowserApi({ allow: ["STAFF"], basePath: "/api/backoffice" });
    await api.apiGet("/actions");
    await api.apiSend("POST", "/actions/a_1/decide", { decision: "approve" });

    expect(calls.filter((call) => call.url === "/api/me")).toHaveLength(1);
    expect(orgHeader(callTo(calls, "/api/backoffice/actions"))).toBe("co_1");
    expect(orgHeader(callTo(calls, "/api/backoffice/actions/a_1/decide"))).toBe("co_1");
  });

  it("picks the oldest membership the app allows when no org is current", async () => {
    const calls = stubWorker(
      { "/api/backoffice/actions/a_1/decide": () => Response.json({}) },
      () =>
        Response.json(
          meBody({
            currentOrg: null,
            orgs: [
              org("co_customer", "CUSTOMER"),
              org("co_staff", "STAFF"),
              org("co_owner", "OWNER"),
            ],
            role: null,
          }),
        ),
    );

    const api = createBrowserApi({ allow: ["OWNER", "STAFF"], basePath: "/api/backoffice" });
    await api.apiSend("POST", "/actions/a_1/decide", { decision: "approve" });

    expect(orgHeader(callTo(calls, "/api/backoffice/actions/a_1/decide"))).toBe("co_staff");
  });

  it("sends the active org on form uploads", async () => {
    const calls = stubWorker({ "/api/me/uploads": () => Response.json({ ok: true }) });

    const api = createBrowserApi({ allow: ["CUSTOMER"] });
    await api.apiSendForm("/api/me/uploads", new FormData());

    const upload = callTo(calls, "/api/me/uploads");
    expect(orgHeader(upload)).toBe("co_1");
    expect(new Headers(upload.init?.headers).has("Content-Type")).toBe(false);
  });

  it("surfaces a failed discovery and retries it on the next call", async () => {
    const meResponses = [new Response("down", { status: 502 }), Response.json(meBody())];
    const calls = stubWorker({ "/api/me/team": () => Response.json({ members: [] }) }, () => {
      const next = meResponses.shift();
      if (next === undefined) {
        throw new Error("discovery ran more than twice");
      }
      return next;
    });

    const api = createBrowserApi({ allow: ["CUSTOMER"] });
    await expect(api.apiGet("/api/me/team")).rejects.toMatchObject({ status: 502 });
    expect(calls.some((call) => call.url === "/api/me/team")).toBe(false);

    await api.apiGet("/api/me/team");
    expect(orgHeader(callTo(calls, "/api/me/team"))).toBe("co_1");
  });

  it("throws ApiError carrying status + body on a non-ok response", async () => {
    stubWorker({ "/x": () => new Response("nope", { status: 403 }) });

    const api = createBrowserApi({ allow: ["CUSTOMER"] });
    await expect(api.apiGet("/x")).rejects.toMatchObject({ body: "nope", status: 403 });
    await expect(api.apiGet("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("returns null on 204", async () => {
    stubWorker({ "/x": () => new Response(null, { status: 204 }) });

    const api = createBrowserApi({ allow: ["CUSTOMER"] });
    expect(await api.apiSend("DELETE", "/x")).toBeNull();
  });

  it("serializes a JSON body and sets Content-Type on apiSend", async () => {
    const calls = stubWorker({ "/api/backoffice/templates": () => Response.json({ id: 1 }) });

    const api = createBrowserApi({ allow: ["STAFF"], basePath: "/api/backoffice" });
    await api.apiSend("POST", "/templates", { name: "x" });

    const { init } = callTo(calls, "/api/backoffice/templates");
    expect(init?.body).toBe(JSON.stringify({ name: "x" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });
});

describe("withOrgQuery", () => {
  it("scopes an EventSource URL to the org, which cannot send headers", () => {
    expect(withOrgQuery("/api/me/team/events", "co 1")).toBe("/api/me/team/events?org_id=co%201");
    expect(withOrgQuery("/x?a=1", "co_1")).toBe("/x?a=1&org_id=co_1");
    expect(withOrgQuery("/x", null)).toBe("/x");
  });
});

describe("createServerApi", () => {
  it("prefixes baseUrl + basePath and forwards the request cookie", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ items: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { apiGetServer } = createServerApi({
      basePath: "/api/backoffice",
      baseUrl: "https://w.example",
      readCookieHeader: () => Promise.resolve("session=abc"),
      readOrgId: () => Promise.resolve("org_1"),
    });
    const out = await apiGetServer<{ items: ReadonlyArray<string> }>("/tickets");

    expect(out).toEqual({ items: [] });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://w.example/api/backoffice/tickets");
    expect(new Headers(init?.headers).get("Cookie")).toBe("session=abc");
    expect(init?.cache).toBe("no-store");
  });

  it("names the tenant with X-Org-Id on every server read", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ ok: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { apiGetServer } = createServerApi({
      baseUrl: "https://w.example",
      readCookieHeader: () => Promise.resolve("session=abc"),
      readOrgId: () => Promise.resolve("org_2"),
    });
    await apiGetServer("/me/company");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("X-Org-Id")).toBe("org_2");
  });

  it("omits the Cookie header when the request carries none", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ ok: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { apiGetServer } = createServerApi({
      baseUrl: "",
      readCookieHeader: () => Promise.resolve(""),
      readOrgId: () => Promise.resolve("org_1"),
    });
    await apiGetServer("/me");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/me");
    expect(new Headers(init?.headers).has("Cookie")).toBe(false);
  });
});

describe("handleResponse", () => {
  it("parses JSON on ok, returns null on 204, and throws ApiError otherwise", async () => {
    expect(await handleResponse<{ a: number }>(Response.json({ a: 1 }))).toEqual({ a: 1 });
    expect(await handleResponse(new Response(null, { status: 204 }))).toBeNull();
    await expect(handleResponse(new Response("bad", { status: 500 }))).rejects.toMatchObject({
      body: "bad",
      status: 500,
    });
    await expect(handleResponse(new Response("bad", { status: 500 }))).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
