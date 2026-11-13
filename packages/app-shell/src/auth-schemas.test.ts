import { describe, expect, it } from "vitest";

import { newPasswordSchema, PASSWORD_HINT, PASSWORD_TOO_SHORT } from "./auth-schemas";

const messageFor = (length: number) =>
  newPasswordSchema.safeParse("a".repeat(length)).error?.issues[0]?.message;

describe("newPasswordSchema", () => {
  it.each([
    [11, false],
    [12, true],
    [128, true],
    [129, false],
  ])("judges a %i-character password as before: %s", (length, accepted) => {
    expect(newPasswordSchema.safeParse("a".repeat(length)).success).toBe(accepted);
  });

  it("words the bounds as before", () => {
    expect(PASSWORD_HINT).toBe("Pelo menos 12 caracteres.");
    expect(PASSWORD_TOO_SHORT).toBe("A senha deve ter pelo menos 12 caracteres.");
    expect(messageFor(11)).toBe("A senha deve ter pelo menos 12 caracteres.");
    expect(messageFor(129)).toBe("A senha deve ter no máximo 128 caracteres");
  });
});
