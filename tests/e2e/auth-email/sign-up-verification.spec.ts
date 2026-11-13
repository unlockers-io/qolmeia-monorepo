import { expect, test } from "@playwright/test";

import { backofficeUrl } from "../../../playwright.config";
import { verificationLink } from "../fixtures/verification.fixture";
import { makeTestEmail } from "../helpers/test-email";

test.use({
  extraHTTPHeaders: { Origin: backofficeUrl },
  storageState: { cookies: [], origins: [] },
});

test.describe("Sign-up email verification", () => {
  test("verify email is sent, clicking the link signs in the clicking context", async ({
    request,
  }, testInfo) => {
    const since = Date.now();
    const email = makeTestEmail(testInfo);
    const password = "SecurePassword1!";

    const signUp = await request.post(`${backofficeUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Verify Me", password },
    });

    expect([200, 201]).toContain(signUp.status());

    const preSignIn = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email, password },
      failOnStatusCode: false,
    });

    expect(preSignIn.status()).not.toBe(200);

    const verifyUrl = await verificationLink({
      sinceMs: since,
      subject: /boas-vindas/iu,
      to: email,
    });

    const verifyResponse = await request.get(verifyUrl, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    expect(verifyResponse.status()).toBe(302);

    const setCookies = verifyResponse
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value);

    expect(setCookies.some((cookie) => cookie.includes("qolmeia.session_token="))).toBe(true);
    const { location } = verifyResponse.headers();

    if (location === undefined) {
      throw new Error("verification response has no Location header");
    }

    expect(new URL(location, backofficeUrl).pathname).toBe("/");

    const postSignIn = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email, password },
    });

    expect(postSignIn.status()).toBe(200);
  });
});
