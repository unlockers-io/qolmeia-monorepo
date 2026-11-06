import {
  confirmTeamInputSchema,
  hireInputSchema,
  memberPatchSchema,
  type ConfirmTeamResponse,
  type MemberDetailResponse,
  type MemberResponse,
  type TeamResponse,
} from "@repo/worker-api/contracts";
import { type Context, Hono } from "hono";

import type { IdentityEnv } from "#/identity/gates";
import { jsonBody } from "#/lib/validate";
import { confirmTeam } from "#/team/confirm";
import { subscribeTeamEvents } from "#/team/events";
import { hireMember, setMemberStatus, updateMember } from "#/team/members";
import { getMemberDetail, getTeamRoster } from "#/team/roster";

/** Mounted by the customer router, which gates it. */
const teamRoutes = new Hono<IdentityEnv>();

teamRoutes.get("/", async (c) => {
  const body: TeamResponse = { members: await getTeamRoster(c.var.db, c.var.session.companyId) };

  return c.json(body);
});

teamRoutes.get("/events", (c) => subscribeTeamEvents(c.env, c.var.session.companyId));

teamRoutes.post("/confirm", jsonBody(confirmTeamInputSchema), async (c) => {
  const { session } = c.var;

  const body: ConfirmTeamResponse = {
    team: await confirmTeam(c.env, c.var.db, {
      actor: session,
      companyId: session.companyId,
      templateIds: c.req.valid("json").templateIds,
    }),
  };

  return c.json(body);
});

teamRoutes.post("/hire", jsonBody(hireInputSchema), async (c) => {
  const { session } = c.var;

  const body: MemberResponse = {
    member: await hireMember(c.env, c.var.db, {
      ...c.req.valid("json"),
      actor: session,
      companyId: session.companyId,
    }),
  };

  return c.json(body);
});

teamRoutes.get("/members/:id", async (c) => {
  const body: MemberDetailResponse = {
    member: await getMemberDetail(c.var.db, c.var.session.companyId, c.req.param("id")),
  };

  return c.json(body);
});

teamRoutes.patch("/members/:id", jsonBody(memberPatchSchema), async (c) => {
  const { session } = c.var;

  const body: MemberResponse = {
    member: await updateMember(c.env, c.var.db, {
      ...c.req.valid("json"),
      actor: session,
      agentInstanceId: c.req.param("id"),
      companyId: session.companyId,
    }),
  };

  return c.json(body);
});

const setStatus = async (
  c: Context<IdentityEnv>,
  agentInstanceId: string,
  status: "active" | "paused",
): Promise<Response> => {
  const body: MemberResponse = {
    member: await setMemberStatus(c.env, c.var.db, {
      actor: c.var.session,
      agentInstanceId,
      companyId: c.var.session.companyId,
      status,
    }),
  };

  return c.json(body);
};

teamRoutes.post("/members/:id/pause", (c) => setStatus(c, c.req.param("id"), "paused"));

teamRoutes.post("/members/:id/resume", (c) => setStatus(c, c.req.param("id"), "active"));

export { teamRoutes };
