import { createPrismaClient, type Prisma, type PrismaClient } from "@repo/db/worker";
import { createMiddleware } from "hono/factory";

type Db = PrismaClient | Prisma.TransactionClient;
type DbVariables = { db: PrismaClient };

const withDb = async <Result>(
  env: Pick<Env, "HYPERDRIVE">,
  run: (db: PrismaClient) => Promise<Result>,
): Promise<Result> => {
  const db = createPrismaClient(env.HYPERDRIVE.connectionString);
  try {
    return await run(db);
  } finally {
    await db.$disconnect();
  }
};

const dbPerRequest = createMiddleware<{ Bindings: Env; Variables: DbVariables }>((c, next) =>
  withDb(c.env, (db) => {
    c.set("db", db);
    return next();
  }),
);

export { dbPerRequest, withDb };
export type { Db, DbVariables };
export type { PrismaClient } from "@repo/db/worker";
