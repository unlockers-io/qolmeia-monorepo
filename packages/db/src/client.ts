import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const searchPathSchema = (databaseUrl: string | undefined): string | undefined => {
  if (databaseUrl === undefined || !URL.canParse(databaseUrl)) {
    return undefined;
  }
  const schema = new URL(databaseUrl).searchParams.get("schema");
  return schema === null || schema === "" ? undefined : schema;
};

const createPrismaClient = (): PrismaClient => {
  const connectionString = process.env.DATABASE_URL;
  const schema = searchPathSchema(connectionString);
  const adapter = new PrismaPg(
    {
      connectionString,
      options: schema === undefined ? undefined : `-c search_path=${schema}`,
    },
    { schema },
  );
  return new PrismaClient({ adapter });
};

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export * from "./generated/prisma/client";
