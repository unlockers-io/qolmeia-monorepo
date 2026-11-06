import { countOperators, isSignupOpen } from "@repo/auth/signup";
import type { SignupState } from "@repo/worker-api/contracts";
import { Hono } from "hono";

import type { DbVariables } from "#/lib/db";

const signupRoutes = new Hono<{ Bindings: Env; Variables: DbVariables }>();

signupRoutes.get("/", async (c) => {
  const body: SignupState = { open: isSignupOpen(await countOperators(c.var.db)) };

  return c.json(body);
});

export { signupRoutes };
