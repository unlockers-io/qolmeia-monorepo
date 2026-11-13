import { countOperators, isSignupOpen } from "@repo/auth/signup";
import { SIGNUP, type ResponseOf } from "@repo/worker-api/endpoints";
import { Hono } from "hono";

import type { DbVariables } from "#/lib/db";

const signupRoutes = new Hono<{ Bindings: Env; Variables: DbVariables }>();

signupRoutes.get(SIGNUP.path, async (c) => {
  const body: ResponseOf<typeof SIGNUP> = { open: isSignupOpen(await countOperators(c.var.db)) };

  return c.json(body);
});

export { signupRoutes };
