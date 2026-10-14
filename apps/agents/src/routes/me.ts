import { log } from "@repo/observability";
import { briefCompleteness, companyBriefSchema } from "@repo/worker-api/brief";
import type { TeamMemberView } from "@repo/worker-api/contracts";
import { type Context, Hono } from "hono";

import { listActivity } from "#/activity/log";
import { getCompany, updateBrief } from "#/company/company";
import {
  fetchMe,
  requireCustomerForWrites,
  requireSession,
  type ValidatedSession,
} from "#/lib/auth";
import { dbPerRequest, type DbVariables } from "#/lib/db";
import { parsePositiveInt } from "#/lib/pagination";
import { meAssetsRoutes } from "#/routes/me-assets";
import { TeamError } from "#/team/errors";
import { subscribeTeamEvents } from "#/team/events";
import {
  hireMember,
  hireTeamMemberSchema,
  setMemberStatus,
  teamMemberPatchSchema,
  updateMember,
} from "#/team/members";
import { getCatalogue, getMemberDetail, getTeamRoster } from "#/team/roster";
import { listEntitledTemplates } from "#/template/template";

type MeEnv = { Bindings: Env; Variables: DbVariables & { session: ValidatedSession } };

const respondToTeamCommand = async (c: Context<MeEnv>, command: Promise<TeamMemberView>) => {
  try {
    return c.json({ member: await command });
  } catch (error) {
    if (error instanceof TeamError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
};

const meRoutes = new Hono<MeEnv>();

meRoutes.get("/", async (c) => {
  const result = await fetchMe(c.req.raw, c.env);
  if (result.kind === "no-credentials") {
    return c.text("Unauthorized", 401);
  }
  if (result.kind === "unreachable") {
    return c.text("Auth service unreachable", 502);
  }

  return new Response(result.body, {
    headers: {
      "Content-Type": "application/json",
      "X-Cache": result.cached ? "hit" : "miss",
    },
    status: result.status,
  });
});

meRoutes.use("*", requireSession);
meRoutes.use("*", requireCustomerForWrites);
meRoutes.use("*", dbPerRequest);

meRoutes.get("/company", async (c) => {
  const { companyId } = c.get("session");
  const row = await getCompany(c.var.db, companyId);
  if (!row) {
    return c.json({ error: "company not found" }, 404);
  }
  return c.json({
    company: row,
    completeness: briefCompleteness(row.brief),
  });
});

const briefPatchSchema = companyBriefSchema.partial();

meRoutes.patch("/company", async (c) => {
  const session = c.get("session");
  const parsed = briefPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body" }, 400);
  }
  const row = await updateBrief(c.var.db, session.companyId, parsed.data);
  if (!row) {
    return c.json({ error: "company not found" }, 404);
  }
  return c.json({
    company: row,
    completeness: briefCompleteness(row.brief),
  });
});

meRoutes.get("/templates", async (c) => {
  const { companyId } = c.get("session");
  const templates = await listEntitledTemplates(c.var.db, companyId);
  return c.json({
    templates: templates.map((t) => ({
      description: t.description,
      displayName: t.displayName,
      id: t.id,
      workerKind: t.workerKind,
    })),
  });
});

meRoutes.get("/team", async (c) => {
  const { companyId } = c.get("session");
  try {
    const members = await getTeamRoster(c.var.db, companyId);
    return c.json({ members });
  } catch (error) {
    log.error({
      companyId,
      error: error instanceof Error ? error.message : String(error),
      message: "me.team.failed",
    });
    return c.json({ error: "failed to load team" }, 500);
  }
});

meRoutes.get("/team/events", (c) => {
  const { companyId } = c.get("session");
  return subscribeTeamEvents(c.env, companyId, c.req.raw.signal);
});

meRoutes.get("/catalogue", async (c) => {
  const session = c.get("session");
  const templates = await getCatalogue(c.var.db, session.companyId);
  return c.json({ templates });
});

meRoutes.post("/team/hire", async (c) => {
  const session = c.get("session");
  const parsed = hireTeamMemberSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body" }, 400);
  }
  return respondToTeamCommand(
    c,
    hireMember(c.env, c.var.db, {
      actorId: session.userId,
      companyId: session.companyId,
      displayName: parsed.data.displayName,
      templateId: parsed.data.templateId,
    }),
  );
});

meRoutes.patch("/team/members/:id", async (c) => {
  const session = c.get("session");
  const id = c.req.param("id");
  const parsed = teamMemberPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "invalid body" }, 400);
  }
  return respondToTeamCommand(
    c,
    updateMember(c.env, c.var.db, {
      agentInstanceId: id,
      companyId: session.companyId,
      displayName: parsed.data.displayName,
      editedBy: "customer",
      operatorId: null,
      promptOverride: parsed.data.promptOverride,
    }),
  );
});

meRoutes.get("/team/members/:id", async (c) => {
  const session = c.get("session");
  const member = await getMemberDetail(c.var.db, session.companyId, c.req.param("id"));
  if (!member) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json({ member });
});

meRoutes.post("/team/members/:id/pause", (c) => {
  const session = c.get("session");
  return respondToTeamCommand(
    c,
    setMemberStatus(c.env, c.var.db, {
      actorId: session.userId,
      agentInstanceId: c.req.param("id"),
      companyId: session.companyId,
      status: "paused",
    }),
  );
});

meRoutes.post("/team/members/:id/resume", (c) => {
  const session = c.get("session");
  return respondToTeamCommand(
    c,
    setMemberStatus(c.env, c.var.db, {
      actorId: session.userId,
      agentInstanceId: c.req.param("id"),
      companyId: session.companyId,
      status: "active",
    }),
  );
});

meRoutes.get("/activity", async (c) => {
  const { companyId } = c.get("session");
  const limit = parsePositiveInt(c.req.query("limit"), 50, 200);
  const entries = await listActivity(c.var.db, { companyId, limit });
  return c.json({
    items: entries.map((entry) => ({
      createdAt: new Date(entry.createdAt).toISOString(),
      id: entry.id,
      summary: entry.summary,
      type: entry.type,
    })),
    nextCursor: null,
  });
});

meRoutes.route("/", meAssetsRoutes);

export { meRoutes };
