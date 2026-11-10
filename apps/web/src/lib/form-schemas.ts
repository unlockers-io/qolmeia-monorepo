import { maxLength } from "@repo/app-shell/form-limits";
import { BRIEF_MAX_LENGTH } from "@repo/worker-api/brief";
import { MEMBER_NAME_MAX_LENGTH, TEAM_SIZE_MAX } from "@repo/worker-api/contracts";
import { z } from "zod";

export const hireSchema = z.object({ displayName: maxLength(MEMBER_NAME_MAX_LENGTH) });

export const companyBriefSchema = z.object({
  audience: maxLength(BRIEF_MAX_LENGTH.audience),
  industry: maxLength(BRIEF_MAX_LENGTH.industry),
  palette: maxLength(BRIEF_MAX_LENGTH.palette),
  primaryGoal: maxLength(BRIEF_MAX_LENGTH.primaryGoal),
  references: maxLength(BRIEF_MAX_LENGTH.references),
  voice: maxLength(BRIEF_MAX_LENGTH.voice),
});

export const confirmTeamSchema = z.object({
  templateIds: z
    .array(z.string())
    .min(1, "Escolha pelo menos um especialista.")
    .max(TEAM_SIZE_MAX, `Escolha no máximo ${TEAM_SIZE_MAX} especialistas.`),
});
