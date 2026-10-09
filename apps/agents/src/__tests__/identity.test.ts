import type { Surface } from "@repo/worker-api/contracts";
import { APIError } from "better-auth/api";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signIn, signInAs } from "#/__tests__/sign-in";
import { resolveIdentity } from "#/identity/identity";
import { createWorkerAuth, type WorkerAuth } from "#/lib/auth";
import { withDb, type Db } from "#/lib/db";

const COMPANY_ID = "co_identity_test";
const OTHER_COMPANY_ID = "co_identity_other";
const QOLMEIA_ORG_ID = "org_qolmeia_identity";

const resolve = (cookie: string | null, surfaces: ReadonlyArray<Surface>) =>
  withDb(env, (db) =>
    resolveIdentity(
      createWorkerAuth(env, db),
      db,
      new Headers(cookie === null ? {} : { cookie }),
      surfaces,
    ),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveIdentity", () => {
  it("resolves a Customer to its Company", async () => {
    const result = await resolve(await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" }), [
      "customer",
    ]);
    expect(result).toMatchObject({
      identity: { companyId: COMPANY_ID, role: "CUSTOMER" },
      kind: "signed-in",
    });
  });

  it("resolves an Operator to the Qolmeia org", async () => {
    const result = await resolve(await signInAs({ orgId: QOLMEIA_ORG_ID, role: "STAFF" }), [
      "operator",
    ]);
    expect(result).toMatchObject({
      identity: { companyId: QOLMEIA_ORG_ID, role: "STAFF" },
      kind: "signed-in",
    });
  });

  it("is signed out without a session cookie", async () => {
    expect(await resolve(null, ["customer"])).toEqual({ kind: "signed-out" });
  });

  it("is signed out when the cookie signature does not verify", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    expect(await resolve(`${cookie.slice(0, -4)}AAAA`, ["customer"])).toEqual({
      kind: "signed-out",
    });
  });

  it("is forbidden on a surface the account has no membership on", async () => {
    const cookie = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    expect(await resolve(cookie, ["operator"])).toEqual({ kind: "forbidden" });
  });

  it("takes the membership of the surface for an account on both surfaces", async () => {
    const cookie = await signIn([
      { orgId: QOLMEIA_ORG_ID, role: "OWNER" },
      { orgId: COMPANY_ID, role: "CUSTOMER" },
    ]);
    expect(await resolve(cookie, ["customer"])).toMatchObject({
      identity: { companyId: COMPANY_ID, role: "CUSTOMER" },
    });
    expect(await resolve(cookie, ["operator"])).toMatchObject({
      identity: { companyId: QOLMEIA_ORG_ID, role: "OWNER" },
    });
  });

  it("takes the first surface in order that the account has a membership on", async () => {
    const both = await signIn([
      { orgId: COMPANY_ID, role: "CUSTOMER" },
      { orgId: QOLMEIA_ORG_ID, role: "STAFF" },
    ]);
    const customer = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });
    expect(await resolve(both, ["operator", "customer"])).toMatchObject({
      identity: { companyId: QOLMEIA_ORG_ID, role: "STAFF" },
    });
    expect(await resolve(customer, ["operator", "customer"])).toMatchObject({
      identity: { companyId: COMPANY_ID, role: "CUSTOMER" },
    });
  });

  it("breaks a tie on one surface with the oldest membership", async () => {
    const cookie = await signIn([
      { orgId: COMPANY_ID, role: "CUSTOMER" },
      { orgId: OTHER_COMPANY_ID, role: "CUSTOMER" },
    ]);
    expect(await resolve(cookie, ["customer"])).toMatchObject({
      identity: { companyId: COMPANY_ID },
    });
  });
});

type FakeSession = { user: { email: string; emailVerified: boolean; id: string; name: string } };

const sessionUser: FakeSession = {
  user: { email: "a@qolmeia.test", emailVerified: true, id: "user_1", name: "A" },
};

const failingDb = {
  orgMembership: { findMany: () => Promise.reject(new Error("connection refused")) },
} as unknown as Db;

const authWith = (getSession: () => Promise<FakeSession>) =>
  ({ api: { getSession } }) as unknown as WorkerAuth;

const headers = new Headers({ cookie: "qolmeia.session_token=t.s" });

describe("resolveIdentity when a dependency fails", () => {
  it("is unavailable, not signed out, when the session store fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authWith(() => Promise.reject(new Error("connection refused")));
    expect(await resolveIdentity(auth, failingDb, headers, ["customer"])).toEqual({
      kind: "unavailable",
    });
  });

  it("is unavailable when the memberships cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authWith(() => Promise.resolve(sessionUser));
    expect(await resolveIdentity(auth, failingDb, headers, ["customer"])).toEqual({
      kind: "unavailable",
    });
  });

  it("is signed out when Better Auth ends the session with 401", async () => {
    const auth = authWith(() => Promise.reject(new APIError("UNAUTHORIZED")));
    expect(await resolveIdentity(auth, failingDb, headers, ["customer"])).toEqual({
      kind: "signed-out",
    });
  });
});
