import "#/lib/observability";

import { DEFAULT_TEMPLATES } from "@repo/db/product-seed";
import { env } from "cloudflare:workers";
import { afterAll, beforeEach } from "vitest";

import { withDb, type PrismaClient } from "#/lib/db";

const truncate = async (db: PrismaClient): Promise<void> => {
  const tables = await db.$queryRaw<Array<{ name: string }>>`
    SELECT quote_ident(tablename) AS name FROM pg_tables WHERE schemaname = current_schema()`;

  await db.$executeRawUnsafe(`TRUNCATE ${tables.map(({ name }) => name).join(", ")} CASCADE`);
};

beforeEach(async () => {
  await withDb(env, async (db) => {
    await truncate(db);
    await db.agentTemplate.createMany({ data: [...DEFAULT_TEMPLATES] });
  });
});

afterAll(async () => {
  await withDb(env, truncate);
});
