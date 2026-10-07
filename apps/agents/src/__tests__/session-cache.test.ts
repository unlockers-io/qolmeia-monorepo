import { describe, expect, it } from "vitest";

import { buildCacheKey } from "#/lib/session-cache";

describe("buildCacheKey", () => {
  it("hashes cookie headers instead of embedding raw secrets", async () => {
    const key = await buildCacheKey({
      cookie: "better-auth.session_token=secret",
      namespace: "session",
      orgId: null,
    });

    expect(key).toMatch(/^session:cookie:[a-f0-9]{64}$/v);
    expect(key).not.toContain("secret");
  });

  it("scopes one cookie's entries per org", async () => {
    const [orgA, orgB, noOrg] = await Promise.all(
      [{ orgId: "org_a" }, { orgId: "org_b" }, { orgId: null }].map((scope) =>
        buildCacheKey({ cookie: "session=abc", namespace: "session", ...scope }),
      ),
    );

    expect(new Set([orgA, orgB, noOrg]).size).toBe(3);
    expect(orgA).toMatch(/^session:cookie:[a-f0-9]{64}$/v);
    expect(orgA).not.toContain("org_a");
  });

  it("keeps an org/credential pair that shares a delimiter in its own entry", async () => {
    const [split, shifted] = await Promise.all(
      [
        { cookie: "b:c", orgId: "a" },
        { cookie: "c", orgId: "a:b" },
      ].map((scope) => buildCacheKey({ namespace: "session", ...scope })),
    );

    expect(split).not.toBe(shifted);
  });
});
