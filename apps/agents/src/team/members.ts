import type { Prisma } from "@repo/db/worker";
import { correspondentIdFor, teamIdFor, type TeamMemberView } from "@repo/worker-api/contracts";
import { z } from "zod";

import { recordActivity } from "#/activity/log";
import type { Db, PrismaClient } from "#/lib/db";
import {
  CorrespondentMissingError,
  InvalidDisplayNameError,
  MemberNotFoundError,
  MemberNotPausableError,
  TemplateNotFoundError,
  TemplateRetiredError,
} from "#/team/errors";
import { emitTeamEvent, type TeamEvent } from "#/team/events";
import { getTeamMember, nextDisplayName } from "#/team/roster";

const teamMemberPatchSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  promptOverride: z.union([z.string().trim().min(1).max(20_000), z.null()]).optional(),
});

const backofficeTeamMemberPatchSchema = teamMemberPatchSchema.extend({
  status: z.enum(["active", "paused"]).optional(),
});

const hireTeamMemberSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  templateId: z.string().min(1),
});

const delegationTargetsSchema = z.array(z.string());

type RosterReason = Extract<TeamEvent, { type: "team:roster" }>["reason"];

type HireInput = {
  actorId: string | null;
  companyId: string;
  displayName: string | undefined;
  templateId: string;
};

type SetMemberStatusInput = {
  actorId: string;
  agentInstanceId: string;
  companyId: string;
  status: "active" | "paused";
};

type UpdateMemberInput = {
  agentInstanceId: string;
  companyId: string;
  displayName: string | undefined;
  editedBy: "customer" | "operator";
  operatorId: string | null;
  promptOverride: string | null | undefined;
};

type RosterChange = {
  change: (tx: Prisma.TransactionClient) => Promise<string>;
  companyId: string;
  reason: RosterReason;
};

const changeRoster = async (
  env: Env,
  db: PrismaClient,
  { change, companyId, reason }: RosterChange,
): Promise<TeamMemberView> => {
  const member = await db.$transaction(async (tx) => {
    const agentInstanceId = await change(tx);
    const view = await getTeamMember(tx, companyId, agentInstanceId);
    if (!view) {
      throw new MemberNotFoundError();
    }
    return view;
  });
  await emitTeamEvent(env, { companyId, reason, type: "team:roster" });
  return member;
};

const lockDelegationTargets = async (
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<ReadonlyArray<string>> => {
  const rows = await tx.$queryRaw<Array<{ can_delegate_to: Prisma.JsonValue }>>`
    SELECT can_delegate_to FROM team_member
    WHERE team_id = ${teamIdFor(companyId)} AND agent_instance_id = ${correspondentIdFor(companyId)}
    FOR UPDATE`;
  const row = rows.at(0);
  if (row === undefined) {
    throw new CorrespondentMissingError();
  }
  return delegationTargetsSchema.safeParse(row.can_delegate_to).data ?? [];
};

const hireMember = (env: Env, db: PrismaClient, input: HireInput): Promise<TeamMemberView> =>
  changeRoster(env, db, {
    change: async (tx) => {
      const template = await tx.agentTemplate.findFirst({
        where: {
          entitlements: { some: { companyId: input.companyId, enabled: true } },
          id: input.templateId,
        },
      });
      if (!template) {
        throw new TemplateNotFoundError(input.templateId);
      }
      if (template.status !== "active") {
        throw new TemplateRetiredError(input.templateId);
      }
      const targets = await lockDelegationTargets(tx, input.companyId);
      const existing = await tx.agentInstance.findMany({
        select: { displayName: true },
        where: { companyId: input.companyId },
      });
      const requestedName = input.displayName?.trim() ?? "";
      const displayName =
        requestedName === ""
          ? nextDisplayName(
              template.displayName,
              existing.map((member) => member.displayName),
            )
          : requestedName;
      const agentInstanceId = `wkr_${crypto.randomUUID()}`;
      const teamId = teamIdFor(input.companyId);
      await tx.agentInstance.create({
        data: {
          companyId: input.companyId,
          displayName,
          id: agentInstanceId,
          role: "worker",
          templateId: template.id,
          templateVersion: template.version,
        },
      });
      await tx.teamMember.create({ data: { agentInstanceId, canDelegateTo: [], teamId } });
      await tx.teamMember.update({
        data: { canDelegateTo: [...targets, agentInstanceId] },
        where: {
          teamId_agentInstanceId: { agentInstanceId: correspondentIdFor(input.companyId), teamId },
        },
      });
      await recordActivity(tx, {
        actorId: input.actorId,
        companyId: input.companyId,
        payload: { displayName, templateId: template.id },
        refId: agentInstanceId,
        refType: "agent_instance",
        summary: `Agente "${displayName}" contratado.`,
        type: "MEMBER_HIRED",
      });
      return agentInstanceId;
    },
    companyId: input.companyId,
    reason: "hired",
  });

const findMember = async (
  db: Db,
  input: { agentInstanceId: string; companyId: string },
): Promise<{ displayName: string; role: string }> => {
  const member = await db.agentInstance.findFirst({
    select: { displayName: true, role: true },
    where: { companyId: input.companyId, id: input.agentInstanceId },
  });
  if (!member) {
    throw new MemberNotFoundError();
  }
  return member;
};

const STATUS_REASON = { active: "resumed", paused: "paused" } as const;

const setMemberStatus = (
  env: Env,
  db: PrismaClient,
  input: SetMemberStatusInput,
): Promise<TeamMemberView> =>
  changeRoster(env, db, {
    change: async (tx) => {
      const member = await findMember(tx, input);
      if (member.role !== "worker") {
        throw new MemberNotPausableError(member.role);
      }
      await tx.agentInstance.update({
        data: { status: input.status },
        where: { id: input.agentInstanceId },
      });
      await recordActivity(tx, {
        actorId: input.actorId,
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
    },
    companyId: input.companyId,
    reason: STATUS_REASON[input.status],
  });

const renameMember = async (
  tx: Prisma.TransactionClient,
  input: UpdateMemberInput & { displayName: string },
  oldName: string,
): Promise<void> => {
  const displayName = input.displayName.trim();
  if (displayName === "") {
    throw new InvalidDisplayNameError();
  }
  if (displayName === oldName) {
    return;
  }
  await tx.agentInstance.update({ data: { displayName }, where: { id: input.agentInstanceId } });
  await recordActivity(tx, {
    actorId: input.operatorId,
    companyId: input.companyId,
    payload: { newName: displayName, oldName },
    refId: input.agentInstanceId,
    refType: "agent_instance",
    summary: `${oldName} agora se chama ${displayName}.`,
    type: "MEMBER_RENAMED",
  });
};

const overridePrompt = async (
  tx: Prisma.TransactionClient,
  input: UpdateMemberInput,
  memberName: string,
): Promise<void> => {
  const trimmed = input.promptOverride?.trim() ?? "";
  const promptOverride = trimmed === "" ? null : trimmed;
  await tx.agentInstance.update({ data: { promptOverride }, where: { id: input.agentInstanceId } });
  await recordActivity(
    tx,
    promptOverride === null
      ? {
          actorId: input.operatorId,
          companyId: input.companyId,
          payload: { editedBy: input.editedBy },
          refId: input.agentInstanceId,
          refType: "agent_instance",
          summary: `Instruções de ${memberName} voltaram ao padrão.`,
          type: "MEMBER_PROMPT_RESET",
        }
      : {
          actorId: input.operatorId,
          companyId: input.companyId,
          payload: { editedBy: input.editedBy, length: input.promptOverride?.length ?? 0 },
          refId: input.agentInstanceId,
          refType: "agent_instance",
          summary: `Instruções de ${memberName} foram personalizadas.`,
          type: "MEMBER_PROMPT_EDITED",
        },
  );
};

const updateMember = (
  env: Env,
  db: PrismaClient,
  input: UpdateMemberInput,
): Promise<TeamMemberView> =>
  changeRoster(env, db, {
    change: async (tx) => {
      const member = await findMember(tx, input);
      if (input.displayName !== undefined) {
        await renameMember(tx, { ...input, displayName: input.displayName }, member.displayName);
      }
      if (input.promptOverride !== undefined) {
        await overridePrompt(tx, input, member.displayName);
      }
      return input.agentInstanceId;
    },
    companyId: input.companyId,
    reason: input.promptOverride === undefined ? "renamed" : "prompt_changed",
  });

export {
  backofficeTeamMemberPatchSchema,
  hireMember,
  hireTeamMemberSchema,
  setMemberStatus,
  teamMemberPatchSchema,
  updateMember,
};
