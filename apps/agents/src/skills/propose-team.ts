import type { CompanyBrief } from "@repo/worker-api/brief";
import { z } from "zod";

import { getCompany } from "#/company/company";
import { withDb } from "#/lib/db";
import { defineSkill } from "#/skills/skill";
import { listEntitledTemplates } from "#/template/template";

const proposeTeamInputSchema = z.object({});

type TeamCandidate = {
  description: string;
  id: string;
  reason: string;
  workerKind: string;
};

type ProposeResult = {
  brief: Partial<CompanyBrief>;
  candidates: ReadonlyArray<TeamCandidate>;
};

const proposeTeamSkill = defineSkill({
  description:
    "Lê o catálogo de especialistas disponíveis e propõe um Time para a empresa com base no brief atual. Use depois de coletar informação suficiente no debrief.",
  displayName: "Propor time",
  async execute(_input, ctx): Promise<ProposeResult> {
    const [templates, company] = await withDb(ctx.env, (db) =>
      Promise.all([listEntitledTemplates(db, ctx.companyId), getCompany(db, ctx.companyId)]),
    );
    const brief = company?.brief ?? {};
    const industry = typeof brief.industry === "string" ? brief.industry : "";

    const candidates: ReadonlyArray<TeamCandidate> = templates.map((t) => ({
      description: t.description,
      id: t.id,
      reason: industry
        ? `Especialista em ${t.workerKind}, adequado para ${industry}.`
        : `Especialista em ${t.workerKind}.`,
      workerKind: t.workerKind,
    }));

    return { brief, candidates };
  },
  id: "proposeTeam",
  inputSchema: proposeTeamInputSchema,
});

export { proposeTeamSkill };
