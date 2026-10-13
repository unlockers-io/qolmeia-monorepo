import { backofficeUrl } from "../../../playwright.config";
import { expect, test } from "../fixtures/auth.fixture";
import { holdScripts } from "../helpers/hold-scripts";

const TEST_USER = {
  email: "e2e-test@qolmeia.localhost",
  password: "TestPassword123!",
};

test.describe("Backoffice login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("logs in with valid credentials", async ({ backofficeLoginPage, page }) => {
    await backofficeLoginPage.goto();
    await backofficeLoginPage.login(TEST_USER.email, TEST_USER.password);

    await page.waitForURL(new RegExp(`${backofficeUrl.replaceAll(".", String.raw`\.`)}/$`, "v"));
    expect(page.url()).not.toContain("/login");
  });

  test("keeps the form disabled until it hydrates", async ({ backofficeLoginPage, page }) => {
    const releaseScripts = await holdScripts(page);
    await page.goto("/login", { waitUntil: "commit" });
    await backofficeLoginPage.expectDisabled();

    releaseScripts();
    await backofficeLoginPage.login(TEST_USER.email, TEST_USER.password);

    await page.waitForURL(new RegExp(`${backofficeUrl.replaceAll(".", String.raw`\.`)}/$`, "v"));
  });

  test("shows error toast for wrong password", async ({ backofficeLoginPage, page }) => {
    await backofficeLoginPage.goto();
    await backofficeLoginPage.login(TEST_USER.email, "WrongPassword!!");

    await backofficeLoginPage.expectErrorVisible();
    expect(page.url()).toContain("/login");
  });
});

test.describe("Backoffice login (already authenticated)", () => {
  test("redirects away from /login when already authenticated", async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    expect(page.url()).not.toContain("/login");
  });
});
