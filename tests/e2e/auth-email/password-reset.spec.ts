import { expect, test } from "@playwright/test";

import { backofficeUrl } from "../../../playwright.config";
import { verificationLink } from "../fixtures/verification.fixture";
import { extractLink, waitForEmail } from "../helpers/mail";
import { makeTestEmail } from "../helpers/test-email";

test.use({
  extraHTTPHeaders: { Origin: backofficeUrl },
  storageState: { cookies: [], origins: [] },
});

test.describe("Password reset", () => {
  test("user can request reset, set a new password, and sign in", async ({ request }, testInfo) => {
    const email = makeTestEmail(testInfo);
    const originalPassword = "OriginalPassword1!";
    const newPassword = "BrandNewPassword2!";
    const signedUpAt = Date.now();

    const signUp = await request.post(`${backofficeUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Reset Me", password: originalPassword },
    });

    expect([200, 201]).toContain(signUp.status());

    await request.get(
      await verificationLink({ sinceMs: signedUpAt, subject: /boas-vindas/iu, to: email }),
      { failOnStatusCode: false, maxRedirects: 0 },
    );

    const since = Date.now();

    const reset = await request.post(`${backofficeUrl}/api/auth/request-password-reset`, {
      data: { email, redirectTo: "/reset-password" },
    });

    expect(reset.status()).toBe(200);

    const mail = await waitForEmail({
      sinceMs: since,
      subject: /redefina sua senha/iu,
      to: email,
    });

    const resetUrl = extractLink(mail, /\/api\/auth\/reset-password\/[^"?]+\?callbackURL=/u);
    const token = new URL(resetUrl).pathname.split("/").pop() ?? "";
    expect(token).not.toBe("");

    const resetResponse = await request.post(
      `${backofficeUrl}/api/auth/reset-password?token=${encodeURIComponent(token)}`,
      { data: { newPassword } },
    );

    expect(resetResponse.status()).toBe(200);

    const oldSignIn = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email, password: originalPassword },
      failOnStatusCode: false,
    });

    expect(oldSignIn.status()).not.toBe(200);

    const newSignIn = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email, password: newPassword },
    });

    expect(newSignIn.status()).toBe(200);
  });
});
