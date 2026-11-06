import { describe, expect, it } from "vitest";

import { loginHref, redirectFrom, safeRedirectPath, withFrom } from "./redirect-path";

describe("safeRedirectPath", () => {
  it("accepts a simple in-app path", () => {
    expect(safeRedirectPath("/tickets")).toBe("/tickets");
  });

  it("accepts the root path", () => {
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("accepts nested paths with query and hash", () => {
    expect(safeRedirectPath("/tickets?status=open#top")).toBe("/tickets?status=open#top");
  });

  it("defaults absent values to /", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
  });

  it("rejects empty string", () => {
    expect(safeRedirectPath("")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com/phish")).toBe("/");
  });

  it("rejects backslash tricks", () => {
    expect(safeRedirectPath(String.raw`/\evil.com`)).toBe("/");
    expect(safeRedirectPath(String.raw`\/evil.com`)).toBe("/");
    expect(safeRedirectPath(String.raw`/path\..\evil`)).toBe("/");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.com/phish")).toBe("/");
    expect(safeRedirectPath("http://localhost:3000/tickets")).toBe("/");
  });

  it("rejects scheme-prefixed values", () => {
    expect(safeRedirectPath(["javascript", "alert(1)"].join(":"))).toBe("/");
    expect(safeRedirectPath("data:text/html,<script>1</script>")).toBe("/");
  });

  it("rejects bare hostnames and relative paths without a leading slash", () => {
    expect(safeRedirectPath("evil.com")).toBe("/");
    expect(safeRedirectPath("tickets")).toBe("/");
    expect(safeRedirectPath(" /tickets")).toBe("/");
  });
});

describe("withFrom", () => {
  it("carries a safe path in from", () => {
    expect(withFrom("/register", "/approvals/act_1")).toBe("/register?from=%2Fapprovals%2Fact_1");
  });

  it("leaves the param out when the target is the root or unsafe", () => {
    expect(withFrom("/register", "/")).toBe("/register");
    expect(withFrom("/register", undefined)).toBe("/register");
    expect(withFrom("/register", "//evil.com")).toBe("/register");
  });
});

describe("loginHref", () => {
  it("sends the visitor to /login remembering the page", () => {
    expect(loginHref("/convite/inv-1")).toBe("/login?from=%2Fconvite%2Finv-1");
    expect(loginHref("/")).toBe("/login");
  });
});

describe("redirectFrom", () => {
  it("reads a safe from out of a query string", () => {
    expect(redirectFrom("?from=%2Ftickets")).toBe("/tickets");
    expect(redirectFrom("?from=https%3A%2F%2Fevil.com")).toBe("/");
    expect(redirectFrom("")).toBe("/");
  });
});
