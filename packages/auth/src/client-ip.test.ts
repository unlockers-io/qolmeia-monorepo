import { describe, expect, it } from "vitest";

import { CLIENT_IP_HEADER, forwardClientIp, withClientIp } from "./client-ip";

const SECRET = "proxy-secret-for-tests";

const request = (headers: Record<string, string>) =>
  new Request("https://agents.test/api/auth/sign-in/email", { headers, method: "POST" });

const clientIpOf = (req: Request) => req.headers.get(CLIENT_IP_HEADER);

describe("withClientIp", () => {
  it("trusts the address a Next app forwarded with the proxy secret", () => {
    const headers = forwardClientIp(new Headers({ "cf-connecting-ip": "76.76.21.1" }), {
      clientIp: "203.0.113.7",
      secret: SECRET,
    });
    const resolved = withClientIp(new Request("https://agents.test/", { headers }), SECRET);
    expect(clientIpOf(resolved)).toBe("203.0.113.7");
  });

  it("ignores a forwarded address without the proxy secret", () => {
    const resolved = withClientIp(
      request({ "cf-connecting-ip": "198.51.100.9", [CLIENT_IP_HEADER]: "203.0.113.7" }),
      SECRET,
    );
    expect(clientIpOf(resolved)).toBe("198.51.100.9");
  });

  it("ignores a forwarded address presented with the wrong secret", () => {
    const resolved = withClientIp(
      request({
        "cf-connecting-ip": "198.51.100.9",
        [CLIENT_IP_HEADER]: "203.0.113.7",
        "x-qolmeia-proxy-secret": "guessed",
      }),
      SECRET,
    );
    expect(clientIpOf(resolved)).toBe("198.51.100.9");
  });

  it("trusts nothing forwarded when the Worker has no proxy secret", () => {
    const resolved = withClientIp(
      request({
        "cf-connecting-ip": "198.51.100.9",
        [CLIENT_IP_HEADER]: "203.0.113.7",
        "x-qolmeia-proxy-secret": "",
      }),
      undefined,
    );
    expect(clientIpOf(resolved)).toBe("198.51.100.9");
  });

  it("never passes the proxy secret on to Better Auth", () => {
    const headers = forwardClientIp(new Headers(), { clientIp: "203.0.113.7", secret: SECRET });
    const resolved = withClientIp(new Request("https://agents.test/", { headers }), SECRET);
    expect(resolved.headers.has("x-qolmeia-proxy-secret")).toBe(false);
  });

  it("leaves no address when neither source has one", () => {
    const resolved = withClientIp(request({ [CLIENT_IP_HEADER]: "203.0.113.7" }), SECRET);
    expect(clientIpOf(resolved)).toBeNull();
  });

  it("keeps the request body", async () => {
    const original = new Request("https://agents.test/api/auth/sign-in/email", {
      body: JSON.stringify({ email: "a@b.c" }),
      method: "POST",
    });
    expect(await withClientIp(original, SECRET).json()).toEqual({ email: "a@b.c" });
  });
});
