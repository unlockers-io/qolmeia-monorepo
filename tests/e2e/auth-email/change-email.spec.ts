import { expect, test } from "@playwright/test";

import { backofficeUrl } from "../../../playwright.config";
import { verificationLink } from "../fixtures/verification.fixture";
import { prisma } from "../helpers/database";
import { makeTestEmail } from "../helpers/test-email";

test.use({
  extraHTTPHeaders: { Origin: backofficeUrl },
  storageState: { cookies: [], origins: [] },
});

test.describe("Change email (two-stage confirmation + verification)", () => {
  test("user changes email: both stage-1 and stage-2 mails are delivered, new email signs in", async ({
    request,
  }, testInfo) => {
    const currentEmail = makeTestEmail(testInfo);
    const newEmail = currentEmail.replace("delivered+", "delivered+new-");
    const password = "ChangeEmailPwd1!";
    const signedUpAt = Date.now();

    const signUp = await request.post(`${backofficeUrl}/api/auth/sign-up/email`, {
      data: { email: currentEmail, name: "Change Me", password },
    });

    expect([200, 201]).toContain(signUp.status());

    await request.get(
      await verificationLink({ sinceMs: signedUpAt, subject: /boas-vindas/iu, to: currentEmail }),
      { failOnStatusCode: false, maxRedirects: 0 },
    );

    const signIn = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email: currentEmail, password },
    });

    expect(signIn.status()).toBe(200);

    const setCookieHeaders = signIn
      .headersArray()
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value);

    const cookieHeader = setCookieHeaders
      .map((c) => {
        const [nameValue = ""] = c.split(";");

        return nameValue.trim();
      })
      .filter(Boolean)
      .join("; ");

    const since = Date.now();

    const change = await request.post(`${backofficeUrl}/api/auth/change-email`, {
      data: { newEmail },
      headers: {
        Cookie: cookieHeader,
        Referer: `${backofficeUrl}/`,
      },
    });

    expect(change.status()).toBe(200);

    const stage1Url = await verificationLink({
      sinceMs: since,
      subject: /troca de e-mail/iu,
      to: currentEmail,
    });

    const stage1Response = await request.get(stage1Url, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    expect([200, 302]).toContain(stage1Response.status());

    const stage2Url = await verificationLink({ sinceMs: since, to: newEmail });

    const stage2Response = await request.get(stage2Url, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });

    expect([200, 302]).toContain(stage2Response.status());

    const updated = await prisma.user.findUnique({ where: { email: newEmail } });
    expect(updated).not.toBeNull();
    const stale = await prisma.user.findUnique({ where: { email: currentEmail } });
    expect(stale).toBeNull();

    const oldLogin = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email: currentEmail, password },
      failOnStatusCode: false,
    });

    expect(oldLogin.status()).toBeGreaterThanOrEqual(400);

    const newLogin = await request.post(`${backofficeUrl}/api/auth/sign-in/email`, {
      data: { email: newEmail, password },
    });

    expect(newLogin.status()).toBe(200);
  });
});
