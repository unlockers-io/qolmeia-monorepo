import type { CompanyBrief } from "@repo/worker-api/brief";
import type { ConfirmTeamResponse } from "@repo/worker-api/contracts";

import { recordActivity } from "#/activity/log";
import { getCompany } from "#/company/company";
import type { Actor } from "#/identity/identity";
import type { PrismaClient } from "#/lib/db";
import { notFound } from "#/lib/errors";
import { insertFacts, type NewFact } from "#/memory/memory";
import { emitTeamEvent } from "#/team/events";
import { correspondentIdFor, teamIdFor, workerIdFor } from "#/team/ids";
import { listEntitledTemplates } from "#/template/template";

type ConfirmedTeam = ConfirmTeamResponse["team"];

const ONBOARDING_SUMMARY = "Time confirmado via onboarding.";

const briefFacts = (brief: Partial<CompanyBrief>, agentInstanceId: string): Array<NewFact> => {
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
        : [{ agentInstanceId, content: `${label}: ${value}`, kind }],
    ),
    { agentInstanceId, content: ONBOARDING_SUMMARY, kind: "onboarding_summary" },
  ];
};

const confirmTeam = async (
  env: Env,
  db: PrismaClient,
  input: { actor: Actor; companyId: string; templateIds: ReadonlyArray<string> },
): Promise<ConfirmedTeam> => {
  const { companyId } = input;
  const templateIds = [...new Set(input.templateIds)];
  const correspondentId = correspondentIdFor(companyId);
  const teamId = teamIdFor(companyId);
  const workerIds = templateIds.map((templateId) => workerIdFor(templateId, companyId));

  await db.$transaction(async (tx) => {
    const [company, templates] = await Promise.all([
      getCompany(tx, companyId),
      listEntitledTemplates(tx, companyId, templateIds),
    ]);

    const missing = templateIds.find((id) => !templates.some((template) => template.id === id));

    if (missing !== undefined) {
      throw notFound(`template ${missing} not found`);
    }

    const existing = await tx.team.findUnique({
      select: { confirmedAt: true },
      where: { companyId },
    });

    const reconfirm = existing !== null && existing.confirmedAt !== null;

    await tx.team.upsert({
      create: { companyId, confirmedAt: new Date(), id: teamId },
      update: reconfirm ? {} : { confirmedAt: new Date() },
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
      })),
      skipDuplicates: true,
    });
    await tx.company.update({ data: { status: "active" }, where: { id: companyId } });

    if (reconfirm) {
      return;
    }

    await recordActivity(tx, {
      actorId: input.actor.userId,
      companyId,
      payload: { correspondentId, teamId, templateIds, workerIds },
      refId: teamId,
      refType: "team",
      summary: "Time confirmado.",
      type: "TEAM_CONFIRMED",
    });
    await insertFacts(tx, companyId, briefFacts(company.brief, correspondentId));
  });
  await emitTeamEvent(env, { companyId, type: "team:roster" });

  return { correspondentId, teamId, workerIds };
};

export { confirmTeam };
