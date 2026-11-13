import { ME, type ResponseOf } from "@repo/worker-api/endpoints";
import { Hono } from "hono";

import { UNRESOLVED_STATUS } from "#/identity/gates";
import { readMe } from "#/identity/identity";
import { createWorkerAuth } from "#/lib/auth";
import type { DbEnv } from "#/lib/db";

/** Answers every signed-in account, whatever its surface: each app reads it to route the caller. */
const identityRoutes = new Hono<DbEnv>().get(ME.path, async (c) => {
  const result = await readMe(createWorkerAuth(c.env, c.var.db), c.var.db, c.req.raw.headers);

  if (result.kind !== "signed-in") {
    return c.body(null, UNRESOLVED_STATUS[result.kind]);
  }

  const body: ResponseOf<typeof ME> = result.me;

  return c.json(body);
});

export { identityRoutes };
