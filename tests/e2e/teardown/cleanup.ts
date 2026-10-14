import { prisma } from "@repo/db";

import { E2E_USER_EMAIL } from "../fixtures/e2e-user";

const cleanup = async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const users = await prisma.user.deleteMany({
      where: {
        OR: [{ email: E2E_USER_EMAIL }, { email: { endsWith: "@resend.dev" } }],
      },
    });
    const verifications = await prisma.verification.deleteMany({
      where: { identifier: { contains: "@resend.dev" } },
    });
    console.log(
      `[E2E Cleanup] Deleted ${users.count} user(s), ${verifications.count} verification(s)`,
    );
  } catch (error) {
    console.error("[E2E Cleanup] Failed to clean up:", error);
  } finally {
    await prisma.$disconnect();
  }
};

export default cleanup;
