import { expect, test } from "@playwright/test";

import { webUrl } from "../../../playwright.config";
import { extractLink, waitForEmail } from "../helpers/resend";
import { makeTestEmail } from "../helpers/test-email";

test.skip(!process.env.RESEND_API_KEY, "needs RESEND_API_KEY (test mode)");

test.describe("Client magic-link login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("request → email lands → click verify → user lands authenticated on /", async ({
    page,
  }, testInfo) => {
    const since = Date.now();
    const email = makeTestEmail(testInfo);

    await page.goto(`${webUrl}/login`);
    await page.getByRole("button", { name: "Entrar com link mágico" }).click();
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Enviar link mágico" }).click();
    await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();

    const mail = await waitForEmail({
      sinceMs: since,
      subject: /link|acesso|magic|sign.?in/iu,
      to: email,
    });
    expect(mail.last_event).not.toBe("bounced");

    const verifyUrl = extractLink(mail, /\/api\/auth\/magic-link\/verify/u);
    expect(verifyUrl.startsWith(`${webUrl}/api/auth/magic-link/verify`)).toBe(true);

    await page.goto(verifyUrl);
    await page.waitForURL(new RegExp(`^${webUrl.replaceAll(".", String.raw`\.`)}/(\\?.*)?$`, "v"));
    expect(page.url()).not.toContain("/login");
    expect(page.url()).not.toContain("/auth/verify");
  });

  test("error param on /auth/verify renders the failure card instead of redirecting", async ({
    page,
  }) => {
    await page.goto(`${webUrl}/auth/verify?error=expired_token`);
    await expect(page.getByRole("heading", { name: "Não conseguimos entrar" })).toBeVisible();
    expect(page.url()).toContain("/auth/verify");
  });
});

test.describe("Client login form validation", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders the sign-in card without a sent state on first load", async ({ page }) => {
    await page.goto(`${webUrl}/login`);

    await expect(page.getByRole("button", { name: "Entrar com link mágico" })).toBeVisible();
    await expect(page.getByText(/verifique seu e-mail/iu)).toHaveCount(0);
  });
});
