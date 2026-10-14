import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma-worker/client";

const createPrismaClient = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export * from "./generated/prisma-worker/client";
export { DEFAULT_SKILLS, DEFAULT_TEMPLATES } from "./product-seed";
export { createPrismaClient };
