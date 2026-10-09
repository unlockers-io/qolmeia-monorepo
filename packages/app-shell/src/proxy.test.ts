import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProxy } from "./proxy";

const proxy = createProxy({ protectedRoutes: ["/", "/approvals"] });

const visit = (path: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(`https://admin.qolmeia.com${path}`, { headers }));

const forwardedHeader = (response: Response, name: string) =>
  response.headers.get(`x-middleware-request-${name}`);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createProxy", () => {
  it("sends a visitor without a session cookie to /login, remembering the page", () => {
    const response = visit("/approvals/act_1");
    expect(response.headers.get("location")).toBe(
      "https://admin.qolmeia.com/login?from=%2Fapprovals%2Fact_1",
    );
  });

  it("lets a visitor holding a session cookie through", () => {
    const response = visit("/approvals", { cookie: "__Secure-qolmeia.session_token=t.s" });
    expect(response.headers.get("location")).toBeNull();
  });

  it("leaves public pages alone", () => {
    expect(visit("/login").headers.get("location")).toBeNull();
  });

  it("forwards the client address with the proxy secret on auth calls", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", "proxy-secret");
    const response = visit("/api/auth/sign-in/email", { "x-forwarded-for": "203.0.113.7" });
    expect(forwardedHeader(response, "x-qolmeia-client-ip")).toBe("203.0.113.7");
    expect(forwardedHeader(response, "x-qolmeia-proxy-secret")).toBe("proxy-secret");
  });

  it("forwards nothing when this app holds no proxy secret", () => {
    const response = visit("/api/auth/sign-in/email", { "x-forwarded-for": "203.0.113.7" });
    expect(forwardedHeader(response, "x-qolmeia-client-ip")).toBeNull();
  });
});
