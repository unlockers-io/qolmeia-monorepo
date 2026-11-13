import { CUSTOMER } from "@repo/worker-api/endpoints";
import { type Context, Hono } from "hono";

import type { IdentityEnv } from "#/identity/gates";
import { answer } from "#/lib/endpoint";
import { confirmTeam } from "#/team/confirm";
import { subscribeTeamEvents } from "#/team/events";
import { hireMember, setMemberStatus, updateMember } from "#/team/members";
import { getMemberDetail, getTeamRoster } from "#/team/roster";

/** Mounted by the customer router, which gates it. */
const teamRoutes = new Hono<IdentityEnv>();

answer(teamRoutes, CUSTOMER.team, async (c) => ({
  members: await getTeamRoster(c.var.db, c.var.session.companyId),
}));

answer(teamRoutes, CUSTOMER.teamEvents, (c) => subscribeTeamEvents(c.env, c.var.session.companyId));

answer(teamRoutes, CUSTOMER.confirmTeam, async (c, { body }) => {
  const { session } = c.var;

  return {
    team: await confirmTeam(c.env, c.var.db, {
      actor: session,
      companyId: session.companyId,
      templateIds: body.templateIds,
    }),
  };
});

answer(teamRoutes, CUSTOMER.hireMember, async (c, { body }) => {
  const { session } = c.var;

  return {
    member: await hireMember(c.env, c.var.db, {
      ...body,
      actor: session,
      companyId: session.companyId,
    }),
  };
});

answer(teamRoutes, CUSTOMER.member, async (c, { params }) => ({
  member: await getMemberDetail(c.var.db, c.var.session.companyId, params.id),
}));

answer(teamRoutes, CUSTOMER.patchMember, async (c, { body, params }) => {
  const { session } = c.var;

  return {
    member: await updateMember(c.env, c.var.db, {
      ...body,
      actor: session,
      agentInstanceId: params.id,
      companyId: session.companyId,
    }),
  };
});

const setStatus = async (
  c: Context<IdentityEnv>,
  agentInstanceId: string,
  status: "active" | "paused",
) => ({
  member: await setMemberStatus(c.env, c.var.db, {
    actor: c.var.session,
    agentInstanceId,
    companyId: c.var.session.companyId,
    status,
  }),
});

answer(teamRoutes, CUSTOMER.pauseMember, (c, { params }) => setStatus(c, params.id, "paused"));

answer(teamRoutes, CUSTOMER.resumeMember, (c, { params }) => setStatus(c, params.id, "active"));

export { teamRoutes };
