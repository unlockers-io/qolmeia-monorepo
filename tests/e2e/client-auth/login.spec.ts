import { webUrl } from "../../../playwright.config";
import { expect, test } from "../fixtures/auth.fixture";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Client login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("keeps the form disabled until it hydrates", async ({ clientLoginPage, page }) => {
    const releaseScripts = await holdScripts(page);
    await page.goto(`${webUrl}/login`, { waitUntil: "commit" });
    await clientLoginPage.expectDisabled();

    releaseScripts();
    await clientLoginPage.signIn("e2e-test@qolmeia.localhost", "WrongPassword!!");

    await clientLoginPage.expectErrorToast();
    expect(page.url()).toContain("/login");
  });
});
