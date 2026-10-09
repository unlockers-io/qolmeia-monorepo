import "#/lib/observability";

import { DEFAULT_TEMPLATES } from "@repo/db/worker";
import { env } from "cloudflare:workers";
import { afterAll, beforeEach } from "vitest";

import { withDb, type PrismaClient } from "#/lib/db";

const PRODUCT_TABLES = [
  "action",
  "activity_log",
  "agent_instance",
  "asset",
  "company",
  "company_template_entitlement",
  "memory_fact",
  "operator_assignment",
  "skill",
  "team",
  "team_member",
  "template",
  "ticket",
];

const AUTH_TABLES = ['"OrgMembership"', '"Organization"', '"User"'];

const truncate = (db: PrismaClient) =>
  db.$executeRawUnsafe(`TRUNCATE ${[...PRODUCT_TABLES, ...AUTH_TABLES].join(", ")} CASCADE`);

beforeEach(async () => {
  await withDb(env, async (db) => {
    await truncate(db);
    await db.agentTemplate.createMany({ data: [...DEFAULT_TEMPLATES] });
  });
  const keys = await env.SESSIONS.list();
  await Promise.allSettled(keys.keys.map(({ name }) => env.SESSIONS.delete(name)));
});

afterAll(async () => {
  await withDb(env, truncate);
});
