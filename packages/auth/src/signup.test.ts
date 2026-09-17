import { describe, expect, it, vi } from "vitest";

import { countOperators, createSignupGuard, isSignupOpen, SIGNUP_CLOSED_MESSAGE } from "./signup";

const runGuard = (path: string, operatorCount: number) => {
  const guard = createSignupGuard(() => Promise.resolve(operatorCount));
  return guard({ path } as Parameters<typeof guard>[0]);
};

describe("isSignupOpen", () => {
  it("is open only until the first operator exists", () => {
    expect(isSignupOpen(0)).toBe(true);
    expect(isSignupOpen(1)).toBe(false);
  });
});

describe("countOperators", () => {
  it("counts OWNER and STAFF memberships only", async () => {
    const count = vi.fn(() => Promise.resolve(2));
    await expect(countOperators({ orgMembership: { count } } as never)).resolves.toBe(2);
    expect(count).toHaveBeenCalledWith({ where: { role: { in: ["OWNER", "STAFF"] } } });
  });
});

describe("createSignupGuard", () => {
  it("lets the first operator sign up", async () => {
    await expect(runGuard("/sign-up/email", 0)).resolves.toBeUndefined();
  });

  it("rejects sign-up once an operator exists", async () => {
    await expect(runGuard("/sign-up/email", 1)).rejects.toMatchObject({
      message: SIGNUP_CLOSED_MESSAGE,
      status: "FORBIDDEN",
    });
  });

  it("ignores every other endpoint", async () => {
    await expect(runGuard("/sign-in/magic-link", 1)).resolves.toBeUndefined();
    await expect(runGuard("/sign-in/email", 1)).resolves.toBeUndefined();
  });
});
