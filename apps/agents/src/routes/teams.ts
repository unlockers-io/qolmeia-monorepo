import { Hono } from "hono";
import { z } from "zod";

import { requireCustomerForWrites, requireSession, type ValidatedSession } from "#/lib/auth";
import { dbPerRequest, type DbVariables } from "#/lib/db";
import { confirmTeam } from "#/team/confirm";
import { TeamError } from "#/team/errors";

type Vars = DbVariables & { session: ValidatedSession };

const teamsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

teamsRoutes.use("*", requireSession);
teamsRoutes.use("*", requireCustomerForWrites);
teamsRoutes.use("*", dbPerRequest);

const confirmBodySchema = z.object({
  templateIds: z.array(z.string().min(1)).min(1).max(20),
});

teamsRoutes.post("/:companyId/confirm", async (c) => {
  const companyId = c.req.param("companyId");
  const session = c.get("session");
  if (session.companyId !== companyId) {
    return c.text("Forbidden", 403);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }
  const parsed = confirmBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  }

  try {
    const team = await confirmTeam(c.env, c.var.db, {
      actorId: session.userId,
      companyId,
      templateIds: parsed.data.templateIds,
    });
    return c.json({ team });
  } catch (error) {
    if (error instanceof TeamError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

export { teamsRoutes };
