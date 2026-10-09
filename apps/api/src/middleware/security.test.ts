import { makeSignature } from "better-auth/crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth";

import { apiRateLimit, requestId, requestSizeLimit } from "./security";

type ContextValue = boolean | number | string | null | undefined;
type JsonBody =
  | boolean
  | number
  | string
  | null
  | ReadonlyArray<JsonBody>
  | { readonly [key: string]: JsonBody | undefined };

const createMockContext = (options: { headers?: Record<string, string> } = {}) => {
  const { headers = {} } = options;
  const variables = new Map<string, ContextValue>();

  return {
    get: vi.fn((key: string) => variables.get(key)),
    header: vi.fn(),
    json: vi.fn((body: JsonBody, status?: number) => ({ body, status })),
    req: {
      header: vi.fn((name: string) => headers[name]),
      method: "GET",
      path: "/test",
      url: "http://localhost/test",
    },
    set: vi.fn((key: string, value: ContextValue) => {
      variables.set(key, value);
    }),
  } as unknown as Context & { json: ReturnType<typeof vi.fn> };
};

describe("requestSizeLimit", () => {
  const next = vi.fn();

  it("should reject requests exceeding max size", async () => {
    const middleware = requestSizeLimit(1024);
    const c = createMockContext({ headers: { "content-length": "2048" } });

    await middleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request entity too large" } },
      413,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should pass requests within size limit", async () => {
    const middleware = requestSizeLimit(1024);
    const c = createMockContext({ headers: { "content-length": "512" } });

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it("should pass requests with no content-length header", async () => {
    const middleware = requestSizeLimit(1024);
    const c = createMockContext();

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it("should use default 10MB limit when no argument provided", async () => {
    const middleware = requestSizeLimit();
    const c = createMockContext({ headers: { "content-length": "5000000" } });

    await middleware(c, next);

    expect(next).toHaveBeenCalled();
  });

  it("should reject when exceeding default 10MB limit", async () => {
    const middleware = requestSizeLimit();
    const c = createMockContext({ headers: { "content-length": "20000000" } });

    await middleware(c, next);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "PAYLOAD_TOO_LARGE", message: "Request entity too large" } },
      413,
    );
  });
});

describe("requestId", () => {
  const next = vi.fn();

  it("should use existing x-request-id header", async () => {
    const c = createMockContext({ headers: { "x-request-id": "existing-id" } });

    await requestId(c, next);

    expect(c.set).toHaveBeenCalledWith("requestId", "existing-id");
    expect(c.header).toHaveBeenCalledWith("x-request-id", "existing-id");
  });

  it("should generate UUID when no x-request-id header", async () => {
    const mockUuid = "generated-uuid-1234";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      mockUuid as `${string}-${string}-${string}-${string}-${string}`,
    );

    const c = createMockContext();

    await requestId(c, next);

    expect(c.set).toHaveBeenCalledWith("requestId", mockUuid);
    expect(c.header).toHaveBeenCalledWith("x-request-id", mockUuid);

    vi.restoreAllMocks();
  });

  it("should call next", async () => {
    const c = createMockContext({ headers: { "x-request-id": "test" } });

    await requestId(c, next);

    expect(next).toHaveBeenCalled();
  });
});

const PROXY_SECRET = "test-trusted-proxy-secret-minimum-32-chars";
const API_LIMIT = 30;

const limitedApp = new Hono();
limitedApp.use("*", apiRateLimit);
limitedApp.get("/api/me", (c) => c.text("ok"));

const sessionCookie = async (token: string, signingSecret?: string): Promise<string> => {
  const { authCookies, secret } = await auth.$context;
  const signed = `${token}.${await makeSignature(token, signingSecret ?? secret)}`;
  return `${authCookies.sessionToken.name}=${encodeURIComponent(signed)}`;
};

const viaProxy = (clientIp: string) => ({
  "x-qolmeia-client-ip": clientIp,
  "x-qolmeia-proxy-secret": PROXY_SECRET,
  "x-real-ip": "192.0.2.40",
});

const statuses = async (
  count: number,
  headersFor: (attempt: number) => Promise<Record<string, string>> | Record<string, string>,
): Promise<Array<number>> => {
  const results: Array<number> = [];
  for (let attempt = 0; attempt < count; attempt++) {
    const res = await limitedApp.request("/api/me", { headers: await headersFor(attempt) });
    results.push(res.status);
  }
  return results;
};

describe("rate-limit key", () => {
  it("gives signed-in users behind one proxy IP separate budgets", async () => {
    const proxyIp = { "x-real-ip": "192.0.2.10" };
    const alice = await sessionCookie("alice-session");
    const bob = await sessionCookie("bob-session");

    const aliceStatuses = await statuses(API_LIMIT + 1, () => ({ ...proxyIp, cookie: alice }));
    expect(aliceStatuses.slice(0, API_LIMIT).every((status) => status === 200)).toBe(true);
    expect(aliceStatuses.at(-1)).toBe(429);

    expect(await statuses(1, () => ({ ...proxyIp, cookie: bob }))).toEqual([200]);
  });

  it("keeps forged forwarding headers in the edge IP's budget", async () => {
    const results = await statuses(API_LIMIT + 1, (attempt) => ({
      "x-forwarded-for": `198.51.100.${attempt}`,
      "x-qolmeia-client-ip": `198.51.100.${attempt}`,
      "x-qolmeia-proxy-secret": "guessed-secret-that-is-long-enough-to-pass",
      "x-real-ip": `198.51.100.${attempt}, 192.0.2.20`,
    }));
    expect(results.at(-1)).toBe(429);
  });

  it("keeps cookies the auth secret did not sign in the edge IP's budget", async () => {
    const results = await statuses(API_LIMIT + 1, async (attempt) => ({
      cookie: await sessionCookie(`forged-${attempt}`, "not-the-better-auth-secret"),
      "x-real-ip": "192.0.2.30",
    }));
    expect(results.at(-1)).toBe(429);
  });

  it("budgets anonymous requests per client IP the trusted proxy forwards", async () => {
    const first = await statuses(API_LIMIT + 1, () => viaProxy("203.0.113.1"));
    expect(first.at(-1)).toBe(429);
    expect(await statuses(1, () => viaProxy("203.0.113.2"))).toEqual([200]);
  });
});
