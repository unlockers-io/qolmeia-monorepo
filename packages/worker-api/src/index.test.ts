import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiGet, apiSend, apiSendForm, createServerApi } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser api", () => {
  it("requests the Worker path as given and parses JSON on apiGet", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ ok: true })),
    );

    vi.stubGlobal("fetch", fetchMock);

    const out = await apiGet<{ ok: boolean }>("/api/backoffice/actions");

    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backoffice/actions",
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("throws ApiError carrying status + body on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 403 }))),
    );

    await expect(apiGet("/x")).rejects.toMatchObject({ body: "nope", status: 403 });
    await expect(apiGet("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("returns null on 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );

    expect(await apiSend("DELETE", "/x")).toBeNull();
  });

  it("serializes a JSON body and sets Content-Type on apiSend", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ id: 1 })),
    );

    vi.stubGlobal("fetch", fetchMock);

    await apiSend("POST", "/api/backoffice/templates", { name: "x" });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(JSON.stringify({ name: "x" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("lets FormData set its own Content-Type on apiSendForm", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ ok: true })),
    );

    vi.stubGlobal("fetch", fetchMock);

    await apiSendForm("/api/me/uploads", new FormData());

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });
});

describe("createServerApi", () => {
  it("prefixes baseUrl and forwards the request cookie", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ items: [] })),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiGetServer } = createServerApi({
      baseUrl: "https://w.example",
      readCookieHeader: () => Promise.resolve("session=abc"),
    });

    const out = await apiGetServer<{ items: ReadonlyArray<string> }>("/api/backoffice/tickets");

    expect(out).toEqual({ items: [] });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://w.example/api/backoffice/tickets");
    expect(new Headers(init?.headers).get("Cookie")).toBe("session=abc");
    expect(init?.cache).toBe("no-store");
  });

  it("omits the Cookie header when the request carries none", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ ok: true })),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { apiGetServer } = createServerApi({
      baseUrl: "",
      readCookieHeader: () => Promise.resolve(""),
    });

    await apiGetServer("/api/me");

    const init = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
    expect(new Headers(init?.headers).has("Cookie")).toBe(false);
  });
});
