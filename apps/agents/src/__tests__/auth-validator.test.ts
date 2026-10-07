import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionInit } from "#/__tests__/session-cookie";
import {
  requireStaffSession,
  validateSession,
  type SessionEnv,
  type SessionResult,
  type ValidatedSession,
} from "#/lib/auth";

const originalFetch = globalThis.fetch;

const meCustomer = {
  currentOrg: { id: "co_1", role: "CUSTOMER" },
  user: { id: "u_1" },
};
const meStaff = {
  currentOrg: { id: "co_1", role: "STAFF" },
  user: { id: "u_2" },
};

const buildRequest = (token: string) =>
  new Request("http://agents.test/agents/correspondent/co_1", sessionInit(token));

const buildOrgScopedRequest = (orgId: string) =>
  new Request(
    "http://agents.test/api/me/company",
    sessionInit("shared-tok", { headers: { "X-Org-Id": orgId } }),
  );

const outboundHeaders = (init: RequestInit | undefined): Record<string, string> =>
  (init?.headers as Record<string, string> | undefined) ?? {};

const expectOk = (result: SessionResult): ValidatedSession => {
  if (result.kind !== "ok") {
    throw new Error(`expected an resolved session, got ${result.kind}`);
  }
  return result.session;
};

const buildStaffApp = () => {
  const app = new Hono<SessionEnv>();
  app.use("*", requireStaffSession);
  app.get("/probe", (c) => c.json({ role: c.get("session").role }));
  return app;
};

const probe = (token: string) =>
  buildStaffApp().fetch(new Request("http://agents.test/probe", sessionInit(token)), env);

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("validateSession", () => {
  it("resolves a CUSTOMER session from /api/me", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const result = await validateSession(buildRequest("tok"), env);
    expect(expectOk(result)).toEqual({ companyId: "co_1", role: "CUSTOMER", userId: "u_1" });
  });

  it("returns role STAFF when the membership says so (guard is the caller's job)", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meStaff)));
    const result = await validateSession(buildRequest("tok"), env);
    expect(expectOk(result).role).toBe("STAFF");
  });

  it("relays the session cookie, and only the cookie, to the auth service", async () => {
    const fetchSpy = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(Response.json(meCustomer)),
    );
    globalThis.fetch = fetchSpy;
    await validateSession(buildRequest("cookie-tok"), env);
    const outbound = outboundHeaders(fetchSpy.mock.calls[0]?.[1]);
    expect(outbound.Cookie).toBe("qolmeia.session_token=cookie-tok");
    expect(outbound.Authorization).toBeUndefined();
  });

  it.each([
    ["a cf_session query token", new Request("http://agents.test/api/me?cf_session=query-tok")],
    [
      "an Authorization bearer token",
      new Request("http://agents.test/api/me", {
        headers: { Authorization: "Bearer header-tok" },
      }),
    ],
  ])("does not authenticate %s", async (_label, request) => {
    const fetchSpy = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    globalThis.fetch = fetchSpy;
    const result = await validateSession(request, env);
    expect(result.kind).toBe("unauthenticated");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports unauthenticated when /api/me responds 401", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("Unauthorized", { status: 401 })));
    const result = await validateSession(buildRequest("tok"), env);
    expect(result.kind).toBe("unauthenticated");
  });

  it.each([429, 500, 503])(
    "reports the auth service unavailable, not the credentials bad, when /api/me responds %i",
    async (status) => {
      globalThis.fetch = vi.fn(() => Promise.resolve(new Response("busy", { status })));
      const result = await validateSession(buildRequest("tok"), env);
      expect(result.kind).toBe("upstream-unavailable");
    },
  );

  it("forwards the end user's IP so the auth service rate-limits per client", async () => {
    const fetchSpy = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(Response.json(meCustomer)),
    );
    globalThis.fetch = fetchSpy;
    const req = new Request(
      "http://agents.test/api/me",
      sessionInit("ip-tok", { headers: { "CF-Connecting-IP": "203.0.113.7" } }),
    );
    await validateSession(req, env);
    expect(outboundHeaders(fetchSpy.mock.calls[0]?.[1])["X-Forwarded-For"]).toBe("203.0.113.7");
  });

  it("distinguishes an unreachable auth service from bad credentials, and logs", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("ECONNREFUSED")));
    const result = await validateSession(buildRequest("tok"), env);
    expect(result.kind).toBe("upstream-unavailable");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({ error: "ECONNREFUSED", message: "me.fetch.failed" }),
    );
    consoleSpy.mockRestore();
  });

  it("reports unauthenticated when no session cookie is present", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    const req = new Request("http://agents.test/agents/correspondent/co_1");
    const result = await validateSession(req, env);
    expect(result.kind).toBe("unauthenticated");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports unauthenticated when the upstream body cannot be parsed", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response("not json", { status: 200 })));
    const result = await validateSession(buildRequest("tok"), env);
    expect(result.kind).toBe("unauthenticated");
  });

  it("forwards X-Org-Id upstream and keeps one token's orgs in separate cache entries", async () => {
    const fetchSpy = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        Response.json({
          currentOrg: { id: outboundHeaders(init)["X-Org-Id"], role: "CUSTOMER" },
          user: { id: "u_1" },
        }),
      ),
    );
    globalThis.fetch = fetchSpy;

    const first = await validateSession(buildOrgScopedRequest("co_a"), env);
    const second = await validateSession(buildOrgScopedRequest("co_b"), env);
    const firstAgain = await validateSession(buildOrgScopedRequest("co_a"), env);

    expect(expectOk(first).companyId).toBe("co_a");
    expect(expectOk(second).companyId).toBe("co_b");
    expect(expectOk(firstAgain).companyId).toBe("co_a");
    expect(outboundHeaders(fetchSpy.mock.calls[0]?.[1])["X-Org-Id"]).toBe("co_a");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("reads the org from the org_id query param, which is all EventSource can send", async () => {
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        Response.json({
          currentOrg: { id: outboundHeaders(init)["X-Org-Id"], role: "CUSTOMER" },
          user: { id: "u_1" },
        }),
      ),
    );

    const session = await validateSession(
      new Request("http://agents.test/api/me/team/events?org_id=co_sse", sessionInit("sse-tok")),
      env,
    );

    expect(expectOk(session).companyId).toBe("co_sse");
  });

  it("reports org-required rather than unauthenticated when the account has many orgs", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          currentOrg: null,
          orgs: [
            { id: "co_a", name: "A", role: "CUSTOMER" },
            { id: "co_b", name: "B", role: "CUSTOMER" },
          ],
          user: { id: "u_1" },
        }),
      ),
    );

    const result = await validateSession(buildRequest("ambiguous-tok"), env);
    if (result.kind !== "org-required") {
      throw new Error(`expected org-required, got ${result.kind}`);
    }
    expect(result.orgs.map((org) => org.id)).toEqual(["co_a", "co_b"]);
  });

  it("still reports unauthenticated when the account belongs to no org at all", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(Response.json({ currentOrg: null, orgs: [], user: { id: "u_1" } })),
    );

    const result = await validateSession(buildRequest("no-org-tok"), env);
    expect(result.kind).toBe("unauthenticated");
  });
});

describe("requireStaffSession", () => {
  it("admits OWNER and STAFF and populates the session variable", async () => {
    for (const role of ["OWNER", "STAFF"]) {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve(Response.json({ currentOrg: { id: "co_1", role }, user: { id: "u_1" } })),
      );
      const res = await probe(`tok-${role}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ role });
    }
  });

  it("rejects CUSTOMER with 403", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(Response.json(meCustomer)));
    const response = await probe("customer-tok");
    expect(response.status).toBe(403);
  });

  it("answers 502, not 401, when the auth service is unreachable", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("ECONNREFUSED")));
    const response = await probe("down-tok");
    expect(response.status).toBe(502);
    consoleSpy.mockRestore();
  });

  it("answers 400 org_required with the org list when the account has many orgs", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          currentOrg: null,
          orgs: [
            { id: "co_a", name: "A", role: "STAFF" },
            { id: "co_b", name: "B", role: "STAFF" },
          ],
          user: { id: "u_1" },
        }),
      ),
    );

    const res = await probe("ambiguous-tok");
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string; orgs: ReadonlyArray<{ id: string }> }>();
    expect(body.error).toBe("org_required");
    expect(body.orgs.map((org) => org.id)).toEqual(["co_a", "co_b"]);
  });
});
