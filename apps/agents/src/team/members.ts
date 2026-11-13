import type { Prisma } from "@repo/db/worker";
import type { TeamMemberView } from "@repo/worker-api/contracts";

import { recordActivity } from "#/activity/log";
import type { Actor } from "#/identity/identity";
import type { Db, PrismaClient } from "#/lib/db";
import { DomainError, notFound } from "#/lib/errors";
import { emitTeamEvent, type TeamEventsEnv } from "#/team/events";
import { getTeamMember, nextDisplayName } from "#/team/roster";

type MemberTarget = { actor: Actor; agentInstanceId: string; companyId: string };

type HireInput = {
  actor: Actor;
  companyId: string;
  displayName?: string;
  templateId: string;
};

type SetMemberStatusInput = MemberTarget & { status: "active" | "paused" };

type UpdateMemberInput = MemberTarget & {
  displayName?: string;
  promptOverride?: string | null;
};

const changeRoster = async (
  env: TeamEventsEnv,
  db: PrismaClient,
  companyId: string,
  change: (tx: Prisma.TransactionClient) => Promise<string>,
): Promise<TeamMemberView> => {
  const member = await db.$transaction(async (tx) => {
    const view = await getTeamMember(tx, companyId, await change(tx));

    if (!view) {
      throw notFound();
    }

    return view;
  });

  await emitTeamEvent(env, { companyId, type: "team:roster" });

  return member;
};

/** Holds the team row until commit, so concurrent hires pick distinct display names. */
const lockTeam = async (tx: Prisma.TransactionClient, companyId: string): Promise<void> => {
  const [team] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM team WHERE company_id = ${companyId} FOR UPDATE`;

  if (team === undefined) {
    throw new DomainError(409, "team not confirmed");
  }
};

const hireMember = (
  env: TeamEventsEnv,
  db: PrismaClient,
  input: HireInput,
): Promise<TeamMemberView> =>
  changeRoster(env, db, input.companyId, async (tx) => {
    const template = await tx.agentTemplate.findFirst({
      where: {
        entitlements: { some: { companyId: input.companyId, enabled: true } },
        id: input.templateId,
      },
    });

    if (!template) {
      throw notFound(`template ${input.templateId} not found`);
    }

    if (template.status !== "active") {
      throw new DomainError(409, `template ${input.templateId} is retired`);
    }

    await lockTeam(tx, input.companyId);

    const existing = await tx.agentInstance.findMany({
      select: { displayName: true },
      where: { companyId: input.companyId },
    });

    const displayName =
      input.displayName ??
      nextDisplayName(
        template.displayName,
        existing.map((member) => member.displayName),
      );

    const agentInstanceId = `wkr_${crypto.randomUUID()}`;
    await tx.agentInstance.create({
      data: {
        companyId: input.companyId,
        displayName,
        id: agentInstanceId,
        role: "worker",
        templateId: template.id,
      },
    });
    await recordActivity(tx, {
      actorId: input.actor.userId,
      companyId: input.companyId,
      payload: { displayName, templateId: template.id },
      refId: agentInstanceId,
      refType: "agent_instance",
      summary: `Agente "${displayName}" contratado.`,
      type: "MEMBER_HIRED",
    });

    return agentInstanceId;
  });

const findMember = async (
  db: Db,
  input: MemberTarget,
): Promise<{ displayName: string; role: string }> => {
  const member = await db.agentInstance.findFirst({
    select: { displayName: true, role: true },
    where: { companyId: input.companyId, id: input.agentInstanceId },
  });

  if (!member) {
    throw notFound();
  }

  return member;
};

const setMemberStatus = (
  env: TeamEventsEnv,
  db: PrismaClient,
  input: SetMemberStatusInput,
): Promise<TeamMemberView> =>
  changeRoster(env, db, input.companyId, async (tx) => {
    const member = await findMember(tx, input);

    if (member.role !== "worker") {
      throw new DomainError(409, `cannot pause/resume a ${member.role}`);
    }

    await tx.agentInstance.update({
      data: { status: input.status },
      where: { id: input.agentInstanceId },
    });
    await recordActivity(tx, {
      actorId: input.actor.userId,
      companyId: input.companyId,
      refId: input.agentInstanceId,
      refType: "agent_instance",
      summary:
        input.status === "active"
          ? `${member.displayName} foi retomado.`
          : `${member.displayName} foi pausado.`,
      type: input.status === "active" ? "MEMBER_RESUMED" : "MEMBER_PAUSED",
    });

    return input.agentInstanceId;
  });

const renameMember = async (
  tx: Prisma.TransactionClient,
  input: UpdateMemberInput & { displayName: string },
  oldName: string,
): Promise<void> => {
  if (input.displayName === oldName) {
    return;
  }

  await tx.agentInstance.update({
    data: { displayName: input.displayName },
    where: { id: input.agentInstanceId },
  });
  await recordActivity(tx, {
    actorId: input.actor.userId,
    companyId: input.companyId,
    payload: { newName: input.displayName, oldName },
    refId: input.agentInstanceId,
    refType: "agent_instance",
    summary: `${oldName} agora se chama ${input.displayName}.`,
    type: "MEMBER_RENAMED",
  });
};

const overridePrompt = async (
  tx: Prisma.TransactionClient,
  input: UpdateMemberInput & { promptOverride: string | null },
  memberName: string,
): Promise<void> => {
  const { actor, agentInstanceId, companyId, promptOverride } = input;
  const ref = { actorId: actor.userId, companyId, refId: agentInstanceId };
  await tx.agentInstance.update({ data: { promptOverride }, where: { id: agentInstanceId } });
  await recordActivity(
    tx,
    promptOverride === null
      ? {
          ...ref,
          payload: { editedBy: actor.surface },
          refType: "agent_instance",
          summary: `Instruções de ${memberName} voltaram ao padrão.`,
          type: "MEMBER_PROMPT_RESET",
        }
      : {
          ...ref,
          payload: { editedBy: actor.surface, length: promptOverride.length },
          refType: "agent_instance",
          summary: `Instruções de ${memberName} foram personalizadas.`,
          type: "MEMBER_PROMPT_EDITED",
        },
  );
};

const updateMember = (
  env: TeamEventsEnv,
  db: PrismaClient,
  input: UpdateMemberInput,
): Promise<TeamMemberView> =>
  changeRoster(env, db, input.companyId, async (tx) => {
    const member = await findMember(tx, input);
    const { displayName, promptOverride } = input;

    if (promptOverride !== undefined && member.role !== "worker") {
      throw new DomainError(409, `cannot edit the prompt of a ${member.role}`);
    }

    if (displayName !== undefined) {
      await renameMember(tx, { ...input, displayName }, member.displayName);
    }

    if (promptOverride !== undefined) {
      await overridePrompt(tx, { ...input, promptOverride }, member.displayName);
    }

    return input.agentInstanceId;
  });

export { hireMember, setMemberStatus, updateMember };
