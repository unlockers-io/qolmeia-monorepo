import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma-worker/client";

const createPrismaClient = (connectionString: string): PrismaClient => {
  const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg(
    {
      connectionString,
      options: schema === undefined || schema === "" ? undefined : `-c search_path=${schema}`,
    },
    { schema },
  );
  return new PrismaClient({ adapter });
};

export * from "./generated/prisma-worker/client";
export { DEFAULT_SKILLS, DEFAULT_TEMPLATES, seedProductDefaults } from "./product-seed";
export { createPrismaClient };
