import { prisma } from "@repo/db";

import { E2E_USER_EMAIL } from "./e2e-user";

const ORG = { id: "e2e-qolmeia-org", name: "Qolmeia E2E", slug: "e2e-qolmeia-org" };

/**
 * An operator membership closes sign-up for everyone else (one-operator rule), so the specs that
 * need the backoffice grant it for their run only.
 */
const grant = async (): Promise<void> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: E2E_USER_EMAIL } });
  await prisma.organization.upsert({ create: ORG, update: {}, where: { id: ORG.id } });
  await prisma.orgMembership.upsert({
    create: { orgId: ORG.id, role: "OWNER", userId: user.id },
    update: { role: "OWNER" },
    where: { userId_orgId: { orgId: ORG.id, userId: user.id } },
  });
};

const revoke = async (): Promise<void> => {
  await prisma.organization.deleteMany({ where: { id: ORG.id } });
};

const operatorAccess = { grant, revoke };

export { operatorAccess };
