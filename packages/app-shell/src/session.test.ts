import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";

import type { GetSession } from "./auth-server";
import { createSessionHelpers, type AppLogger } from "./session";

const helpersWith = (getSession: GetSession) =>
  createSessionHelpers({
    allow: ["CUSTOMER"],
    getSession,
    log: { error: vi.fn<AppLogger["error"]>() },
    readHeaders: () => Promise.resolve(new Headers({ cookie: "qolmeia.session_token=tok" })),
  });

const failingWith =
  (failure: Error): GetSession =>
  () =>
    Promise.reject(failure);

const redirectTo = (path: string) => ({ digest: expect.stringContaining(`;${path};`) });

describe("requireSession", () => {
  it("sends a signed-out visitor to /login", async () => {
    const helpers = helpersWith(() => Promise.resolve(null));
    await expect(helpers.requireSession()).rejects.toMatchObject(redirectTo("/login"));
  });

  it("sends a visitor whose session ended mid-refresh to /login", async () => {
    const helpers = helpersWith(failingWith(new APIError("UNAUTHORIZED")));
    await expect(helpers.requireSession()).rejects.toMatchObject(redirectTo("/login"));
  });

  it("throws when the auth store fails, so the route's error boundary renders", async () => {
    const outage = new APIError("INTERNAL_SERVER_ERROR");
    const helpers = helpersWith(failingWith(outage));
    await expect(helpers.requireSession()).rejects.toBe(outage);
  });

  it("throws when the database is unreachable", async () => {
    const outage = new Error("connect ECONNREFUSED 127.0.0.1:5432");
    const helpers = helpersWith(failingWith(outage));
    await expect(helpers.requireSession()).rejects.toBe(outage);
  });
});
