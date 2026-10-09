import { readForwardedClientIp } from "@repo/internal-auth";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardAuthRequest } from "./auth-proxy";

const SECRET = "trusted-proxy-secret-at-least-32-chars";

const upstreamHeaders = (response: Response): Headers => {
  const headers = new Headers();
  for (const [name, value] of response.headers) {
    if (name.startsWith("x-middleware-request-")) {
      headers.set(name.slice("x-middleware-request-".length), value);
    }
  }
  return headers;
};

const signIn = (headers: Record<string, string>) =>
  new NextRequest("https://app.qolmeia.com/api/auth/sign-in/email", { headers, method: "POST" });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("forwardAuthRequest", () => {
  it("forwards the client IP Vercel observed, with the proxy secret", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", SECRET);
    const response = forwardAuthRequest(signIn({ "x-forwarded-for": "203.0.113.7" }));
    expect(readForwardedClientIp(upstreamHeaders(response), SECRET)).toBe("203.0.113.7");
  });

  it("replaces a client IP and secret the browser sent itself", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", SECRET);
    const response = forwardAuthRequest(
      signIn({
        "x-forwarded-for": "203.0.113.7",
        "x-qolmeia-client-ip": "198.51.100.1",
        "x-qolmeia-proxy-secret": "guess",
      }),
    );
    expect(readForwardedClientIp(upstreamHeaders(response), SECRET)).toBe("203.0.113.7");
  });

  it("leaves the request untouched when the secret is unset", () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", "");
    const response = forwardAuthRequest(signIn({ "x-forwarded-for": "203.0.113.7" }));
    expect(response.headers.has("x-middleware-override-headers")).toBe(false);
  });
});
