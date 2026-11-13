import { authEnv, envAuthConfig } from "@repo/auth/env-config";
import { createAuth } from "@repo/auth/server";
import { createPrismaClient, seedProductDefaults } from "@repo/db";
import { loopbackUrl } from "@repo/portless-env/apps";
import { createTransport } from "@repo/transactional/transport";
import { z } from "zod";

import { correspondentIdFor, teamIdFor, workerIdFor } from "#/team/ids";

const env = z
  .object({
    ...authEnv.shape,
    BETTER_AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),
    MAIL_TRANSPORT: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
  })
  .parse(process.env);

const prisma = createPrismaClient(env.DATABASE_URL);

const ORG_ID = "cmpg10ke30000147uj4gpeadb";
const ORG_NAME = "Qolmeia Dev";
const ORG_SLUG = "qolmeia-dev";

const OWNER_EMAIL = "operator@qolmeia.dev";
const OWNER_NAME = "Operador Qolmeia";
const OWNER_PASSWORD = "Qolmeia-Dev-OperatorPass!";

const CUSTOMER_EMAIL = "customer@qolmeia.dev";
const CUSTOMER_NAME = "Cliente Demo";
const CUSTOMER_PASSWORD = "Qolmeia-Dev-CustomerPass!";

const auth = createAuth({
  ...envAuthConfig(env),
  fallbackBaseURL: loopbackUrl("agents", "127.0.0.1"),
  prisma,
  secret: env.BETTER_AUTH_SECRET,
  transport: createTransport({ apiKey: env.RESEND_API_KEY, transport: env.MAIL_TRANSPORT }),
});

const upsertOrg = async () => {
  const existing = await prisma.organization.findUnique({ where: { id: ORG_ID } });

  if (existing) {
    return existing;
  }

  return prisma.organization.create({
    data: {
      id: ORG_ID,
      name: ORG_NAME,
      slug: ORG_SLUG,
    },
  });
};

const upsertUser = async (
  email: string,
  name: string,
  password: string,
): Promise<{ created: boolean; userId: string }> => {
  const existing = await prisma.user.findUnique({
    select: { id: true },
    where: { email },
  });

  if (existing) {
    return { created: false, userId: existing.id };
  }

  const result = await auth.api.signUpEmail({ body: { email, name, password } });

  if (!result.user.id) {
    throw new Error(`Better Auth signUpEmail returned no user id for ${email}`);
  }

  await prisma.user.update({ data: { emailVerified: true }, where: { id: result.user.id } });

  return { created: true, userId: result.user.id };
};

const upsertMembership = async (
  userId: string,
  role: "OWNER" | "STAFF" | "CUSTOMER",
): Promise<void> => {
  await prisma.orgMembership.upsert({
    create: { orgId: ORG_ID, role, userId },
    update: { role },
    where: { userId_orgId: { orgId: ORG_ID, userId } },
  });
};

const seedProductCompany = async (): Promise<void> => {
  await prisma.company.upsert({
    create: { id: ORG_ID, name: ORG_NAME, slug: ORG_SLUG, status: "active" },
    update: { name: ORG_NAME, slug: ORG_SLUG },
    where: { id: ORG_ID },
  });
  await seedProductDefaults(prisma);

  const correspondentId = correspondentIdFor(ORG_ID);
  const workerId = workerIdFor("tpl-designer", ORG_ID);
  const teamId = teamIdFor(ORG_ID);
  await prisma.agentInstance.createMany({
    data: [
      {
        companyId: ORG_ID,
        displayName: "Correspondente Qolmeia",
        id: correspondentId,
        role: "correspondent",
      },
      {
        companyId: ORG_ID,
        displayName: "Designer",
        id: workerId,
        role: "worker",
        templateId: "tpl-designer",
      },
    ],
    skipDuplicates: true,
  });
  await prisma.team.upsert({
    create: { companyId: ORG_ID, confirmedAt: new Date(), id: teamId },
    update: {},
    where: { companyId: ORG_ID },
  });
};

const main = async () => {
  const org = await upsertOrg();
  console.log(`Organization: ${org.id} (${org.slug})`);
  await seedProductCompany();
  console.log("  Product company, catalog, and demo team seeded with Prisma");

  const [owner, customer] = await Promise.all([
    upsertUser(OWNER_EMAIL, OWNER_NAME, OWNER_PASSWORD),
    upsertUser(CUSTOMER_EMAIL, CUSTOMER_NAME, CUSTOMER_PASSWORD),
  ]);

  await upsertMembership(owner.userId, "OWNER");
  await upsertMembership(customer.userId, "CUSTOMER");
  console.log(
    `  OWNER user:    ${OWNER_EMAIL}${owner.created ? ` (password: ${OWNER_PASSWORD})` : " (already existed)"}`,
  );
  console.log(
    `  CUSTOMER user: ${CUSTOMER_EMAIL}${customer.created ? ` (password: ${CUSTOMER_PASSWORD})` : " (already existed)"}`,
  );
};

await main();

await prisma.$disconnect();
