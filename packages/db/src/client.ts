import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

const searchPathSchema = (databaseUrl: string): string | undefined => {
  if (!URL.canParse(databaseUrl)) {
    return undefined;
  }

  const schema = new URL(databaseUrl).searchParams.get("schema");

  return schema === null || schema === "" ? undefined : schema;
};

const createPrismaClient = (databaseUrl: string): PrismaClient => {
  // node-postgres reads a blank connection string as absent and connects to libpq's defaults.
  if (databaseUrl.trim() === "") {
    throw new Error("createPrismaClient needs a database URL and got a blank one.");
  }

  const schema = searchPathSchema(databaseUrl);

  const adapter = new PrismaPg(
    {
      connectionString: databaseUrl,
      options: schema === undefined ? undefined : `-c search_path=${schema}`,
    },
    { schema },
  );

  return new PrismaClient({ adapter });
};

export { createPrismaClient };

export * from "./generated/prisma/client";
