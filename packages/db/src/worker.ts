import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma-worker/client";

const createPrismaClient = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export * from "./generated/prisma-worker/client";

export { entitleToActiveTemplates } from "./entitlement";

export { createPrismaClient };
