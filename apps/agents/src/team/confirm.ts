import { log } from "@repo/observability";
import type { CompanyBrief } from "@repo/worker-api/brief";
import { correspondentIdFor, teamIdFor, workerIdFor } from "@repo/worker-api/contracts";

import { recordActivity } from "#/activity/log";
import { getCompany } from "#/company/company";
import type { PrismaClient } from "#/lib/db";
import { indexMemoryFacts, recordMemoryFacts, type NewMemoryFact } from "#/memory/facts";
import { CompanyNotFoundError, TemplateNotFoundError } from "#/team/errors";
import { emitTeamEvent } from "#/team/events";
import { listEntitledTemplates } from "#/template/template";

type ConfirmedTeam = {
  correspondentId: string;
  teamId: string;
  workerIds: ReadonlyArray<string>;
};

const ONBOARDING_SUMMARY = "Time confirmado via onboarding.";

const briefFacts = (
  brief: Partial<CompanyBrief>,
  owner: Pick<NewMemoryFact, "agentInstanceId" | "companyId">,
): Array<NewMemoryFact> => {
  const facts = [
    { kind: "industry", label: "Setor", value: brief.industry },
    { kind: "goal", label: "Objetivo principal", value: brief.primaryGoal },
    { kind: "audience", label: "Público", value: brief.audience },
    { kind: "channels", label: "Canais ativos", value: brief.channels?.join(", ") },
    { kind: "brand_voice", label: "Tom da marca", value: brief.brand?.voice },
    { kind: "brand_palette", label: "Paleta", value: brief.brand?.palette },
  ];
  return [
    ...facts.flatMap(({ kind, label, value }) =>
      value === undefined || value === ""
        ? []
        : [{ ...owner, content: `${label}: ${value}`, kind }],
    ),
    { ...owner, content: ONBOARDING_SUMMARY, kind: "onboarding_summary" },
  ];
};

const confirmTeam = async (
  env: Env,
  db: PrismaClient,
  input: { actorId: string; companyId: string; templateIds: ReadonlyArray<string> },
): Promise<ConfirmedTeam> => {
  const { companyId } = input;
  const templateIds = [...new Set(input.templateIds)];
  const correspondentId = correspondentIdFor(companyId);
  const teamId = teamIdFor(companyId);
  const workerIds = templateIds.map((templateId) => workerIdFor(templateId, companyId));

  const facts = await db.$transaction(async (tx) => {
    const company = await getCompany(tx, companyId);
    if (!company) {
      throw new CompanyNotFoundError();
    }
    const templates = await listEntitledTemplates(tx, companyId, templateIds);
    const missing = templateIds.find((id) => !templates.some((template) => template.id === id));
    if (missing !== undefined) {
      throw new TemplateNotFoundError(missing);
    }
    const confirmedAt = new Date();
    await tx.team.upsert({
      create: { companyId, confirmedAt, id: teamId },
      update: { confirmedAt },
      where: { companyId },
    });
    await tx.agentInstance.upsert({
      create: {
        companyId,
        displayName: "Correspondente",
        id: correspondentId,
        role: "correspondent",
      },
      update: {},
      where: { id: correspondentId },
    });
    await tx.agentInstance.createMany({
      data: templates.map((template) => ({
        companyId,
        displayName: template.displayName,
        id: workerIdFor(template.id, companyId),
        role: "worker" as const,
        templateId: template.id,
        templateVersion: template.version,
      })),
      skipDuplicates: true,
    });
    await tx.teamMember.upsert({
      create: { agentInstanceId: correspondentId, canDelegateTo: workerIds, teamId },
      update: { canDelegateTo: workerIds },
      where: { teamId_agentInstanceId: { agentInstanceId: correspondentId, teamId } },
    });
    await tx.teamMember.createMany({
      data: workerIds.map((agentInstanceId) => ({ agentInstanceId, canDelegateTo: [], teamId })),
      skipDuplicates: true,
    });
    await tx.company.update({ data: { status: "active" }, where: { id: companyId } });
    await recordActivity(tx, {
      actorId: input.actorId,
      companyId,
      payload: { correspondentId, teamId, templateIds, workerIds },
      refId: teamId,
      refType: "team",
      summary: "Time confirmado.",
      type: "TEAM_CONFIRMED",
    });
    return recordMemoryFacts(
      tx,
      briefFacts(company.brief, { agentInstanceId: correspondentId, companyId }),
    );
  });

  try {
    await indexMemoryFacts(env, facts);
  } catch (error) {
    log.error({
      companyId,
      error: error instanceof Error ? error.message : String(error),
      message: "team.confirm.memory_index_failed",
    });
  }
  await emitTeamEvent(env, { companyId, reason: "confirmed", type: "team:roster" });
  return { correspondentId, teamId, workerIds };
};

export { confirmTeam };
