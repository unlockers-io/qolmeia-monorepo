import { randomUUID } from "node:crypto";

import { expect, test } from "../fixtures/auth.fixture";

test.describe("Backoffice register", () => {
  test("flags mismatched passwords on the confirmation field", async ({
    backofficeRegisterPage,
    page,
  }) => {
    await page.context().clearCookies();

    await backofficeRegisterPage.goto();
    await backofficeRegisterPage.register(
      "Mismatch User",
      `mismatch-${randomUUID()}@qolmeia.localhost`,
      "SecurePassword1!",
      "DifferentPassword!",
    );

    await backofficeRegisterPage.expectPasswordMismatch();
    expect(page.url()).toContain("/register");
  });

  test("redirects away from /register when already authenticated", async ({ page }) => {
    await page.goto("/register");
    await page.waitForURL((url) => !url.pathname.startsWith("/register"));
    expect(page.url()).not.toContain("/register");
  });
});
