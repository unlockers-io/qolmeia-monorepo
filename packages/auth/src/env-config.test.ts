import { matchesHostPattern } from "better-auth";
import { describe, expect, it } from "vitest";

import { envAuthConfig, parseEnvList } from "./env-config";

describe("parseEnvList", () => {
  it("returns an empty list for undefined or empty input", () => {
    expect(parseEnvList(undefined)).toEqual([]);
    expect(parseEnvList("")).toEqual([]);
  });

  it("splits on commas and trims each entry", () => {
    expect(parseEnvList(" a.com , b.com ")).toEqual(["a.com", "b.com"]);
  });

  it("drops empty entries", () => {
    expect(parseEnvList("a.com,,b.com,")).toEqual(["a.com", "b.com"]);
  });
});

describe("envAuthConfig", () => {
  it("includes the localhost host patterns and loopback origins by default", () => {
    const config = envAuthConfig({});
    expect(config.allowedHosts).toEqual(
      expect.arrayContaining(["**.localhost", "**.localhost:*", "localhost:*", "127.0.0.1:*"]),
    );
    expect(config.trustedOrigins).toContain("http://localhost:3000");
    expect(config.trustedOrigins).toContain("http://127.0.0.1:3000");
  });

  it("allows portless hosts on port 443 and on its unprivileged fallback port", () => {
    const { allowedHosts } = envAuthConfig({});
    for (const host of ["qolmeia.web.localhost", "qolmeia.web.localhost:1355"]) {
      expect(allowedHosts.some((pattern) => matchesHostPattern(host, pattern))).toBe(true);
    }
  });

  it("extends trustedOrigins from TRUSTED_ORIGINS", () => {
    const { trustedOrigins } = envAuthConfig({
      TRUSTED_ORIGINS: "https://app.qolmeia.com,https://admin.qolmeia.com",
    });
    expect(trustedOrigins).toContain("https://app.qolmeia.com");
    expect(trustedOrigins).toContain("https://admin.qolmeia.com");
    expect(trustedOrigins).toContain("http://localhost:3000");
  });

  it("gates useSecureCookies on WEB_APP_URL being HTTPS", () => {
    expect(envAuthConfig({}).useSecureCookies).toBe(false);
    expect(envAuthConfig({ WEB_APP_URL: "http://localhost:3000" }).useSecureCookies).toBe(false);
    expect(envAuthConfig({ WEB_APP_URL: "https://app.qolmeia.com" }).useSecureCookies).toBe(true);
  });
});
