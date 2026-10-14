import { ApiError } from "@repo/worker-api";
import type { MeOrg, MeResponse, Surface } from "@repo/worker-api/contracts";
import { describe, expect, it, vi } from "vitest";

import { createSessionHelpers, type AppLogger } from "./session";

const user = {
  displayName: null,
  email: "a@qolmeia.test",
  emailVerified: true,
  id: "user_1",
  image: null,
  name: "A",
  username: null,
};

const org = (id: string, role: MeOrg["role"]): MeOrg => ({ id, name: id, role, slug: id });

const helpersFor = (surface: Surface, readMe: ReadMe) =>
  createSessionHelpers({ log: { error: vi.fn<AppLogger["error"]>() }, readMe, surface });

type ReadMe = () => Promise<MeResponse>;

const answering =
  (orgs: ReadonlyArray<MeOrg>): ReadMe =>
  () =>
    Promise.resolve({ orgs, user });

const failingWith =
  (failure: Error): ReadMe =>
  () =>
    Promise.reject(failure);

const redirectTo = (path: string) => ({ digest: expect.stringContaining(`;${path};`) });

describe("requireMembership", () => {
  it("returns the membership of the app's surface", async () => {
    const helpers = helpersFor(
      "customer",
      answering([org("qolmeia", "OWNER"), org("co_a", "CUSTOMER")]),
    );
    await expect(helpers.requireMembership()).resolves.toEqual({
      org: org("co_a", "CUSTOMER"),
      user,
    });
  });

  it("sends a signed-out visitor to /login", async () => {
    const helpers = helpersFor("operator", failingWith(new ApiError(401, "")));
    await expect(helpers.requireMembership()).rejects.toMatchObject(redirectTo("/login"));
  });

  it("sends an account with no membership on the surface to /no-access", async () => {
    const helpers = helpersFor("operator", answering([org("co_a", "CUSTOMER")]));
    await expect(helpers.requireMembership()).rejects.toMatchObject(redirectTo("/no-access"));
  });

  it("throws when the Worker cannot resolve identity, so the error boundary renders", async () => {
    const outage = new ApiError(503, "");
    const helpers = helpersFor("customer", failingWith(outage));
    await expect(helpers.requireMembership()).rejects.toBe(outage);
  });

  it("throws when the Worker is unreachable", async () => {
    const outage = new TypeError("fetch failed");
    const helpers = helpersFor("customer", failingWith(outage));
    await expect(helpers.requireMembership()).rejects.toBe(outage);
  });
});
