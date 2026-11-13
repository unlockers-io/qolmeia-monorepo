import { afterEach, describe, expect, it, vi } from "vitest";

import { BACKOFFICE, CUSTOMER, ME } from "./endpoints";

import { ApiError, apiCall, createServerApi } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFetch = (respond: () => Response) => {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(respond()));
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

describe("browser api", () => {
  it("requests the endpoint's method and path and parses JSON", async () => {
    const fetchMock = stubFetch(() => Response.json({ items: [] }));

    await expect(apiCall(BACKOFFICE.pendingActions)).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backoffice/actions",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("fills path parameters and the query string", async () => {
    const fetchMock = stubFetch(() => Response.json({ items: [] }));

    await apiCall(BACKOFFICE.member, { params: { companyId: "co 1", id: "m/1" } });
    await apiCall(BACKOFFICE.activity, {
      query: { before: undefined, category: "ACTION", limit: 50 },
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/backoffice/teams/co%201/members/m%2F1",
      "/api/backoffice/activity?category=ACTION&limit=50",
    ]);
  });

  it("throws ApiError carrying status + body on a non-ok response", async () => {
    stubFetch(() => new Response("nope", { status: 403 }));

    await expect(apiCall(ME)).rejects.toMatchObject({ body: "nope", status: 403 });
    await expect(apiCall(ME)).rejects.toBeInstanceOf(ApiError);
  });

  it("serializes a JSON body and sets Content-Type", async () => {
    const fetchMock = stubFetch(() => Response.json({ ok: true }));

    await apiCall(BACKOFFICE.decide, { body: { decision: "approved" }, params: { id: "a1" } });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/backoffice/actions/a1/decide");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ decision: "approved" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("lets FormData set its own Content-Type", async () => {
    const fetchMock = stubFetch(() => Response.json({ ok: true }));

    await apiCall(CUSTOMER.uploadChatFile, { body: new FormData() });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });
});

describe("createServerApi", () => {
  it("prefixes baseUrl and forwards the request cookie", async () => {
    const fetchMock = stubFetch(() => Response.json({ items: [] }));

    const { apiGetServer } = createServerApi({
      baseUrl: "https://w.example",
      readCookieHeader: () => Promise.resolve("session=abc"),
    });

    await expect(apiGetServer(BACKOFFICE.tickets, { query: { limit: 5 } })).resolves.toEqual({
      items: [],
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://w.example/api/backoffice/tickets?limit=5");
    expect(new Headers(init?.headers).get("Cookie")).toBe("session=abc");
    expect(init?.cache).toBe("no-store");
  });

  it("omits the Cookie header when the request carries none", async () => {
    const fetchMock = stubFetch(() => Response.json({ orgs: [] }));

    const { apiGetServer } = createServerApi({
      baseUrl: "",
      readCookieHeader: () => Promise.resolve(""),
    });

    await apiGetServer(ME);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
    expect(new Headers(init?.headers).has("Cookie")).toBe(false);
  });
});
