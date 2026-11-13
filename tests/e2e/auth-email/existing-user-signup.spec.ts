import { expect, test } from "@playwright/test";
import { prisma } from "@repo/db";

import { backofficeUrl } from "../../../playwright.config";
import { waitForEmail } from "../helpers/mail";
import { makeTestEmail } from "../helpers/test-email";

test.use({
  extraHTTPHeaders: { Origin: backofficeUrl },
  storageState: { cookies: [], origins: [] },
});

test.describe("Sign-up for an existing email (enumeration prevention)", () => {
  test("second signup returns synthetic success, notifies the real account holder, no duplicate row", async ({
    request,
  }, testInfo) => {
    const email = makeTestEmail(testInfo);

    const first = await request.post(`${backofficeUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Original Name", password: "FirstPassword1!" },
    });

    expect([200, 201]).toContain(first.status());

    const since = Date.now();

    const second = await request.post(`${backofficeUrl}/api/auth/sign-up/email`, {
      data: { email, name: "Different Name", password: "SecondPassword2!" },
    });

    expect([200, 201]).toContain(second.status());

    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
    expect(users[0]?.name).toBe("Original Name");

    await waitForEmail({ sinceMs: since, subject: /tentativa de cadastro/iu, to: email });
  });
});
