import { companyBriefSchema, type CompanyBrief } from "@repo/worker-api/brief";

import { updateBrief } from "#/company/company";
import { withDb } from "#/lib/db";
import { defineSkill } from "#/skills/skill";

const extractBriefInputSchema = companyBriefSchema.partial();

const extractBriefSkill = defineSkill({
  description:
    "Atualiza o brief da empresa com o que você acabou de aprender na conversa. Envie apenas os campos que mudaram; campos não enviados são preservados. Chame conforme a conversa evolui.",
  displayName: "Atualizar brief",
  async execute(updates, ctx): Promise<{ brief: Partial<CompanyBrief> }> {
    const row = await withDb(ctx.env, (db) => updateBrief(db, ctx.companyId, updates));
    if (!row) {
      throw new Error(`company ${ctx.companyId} not found`);
    }
    return { brief: row.brief };
  },
  id: "extractBrief",
  inputSchema: extractBriefInputSchema,
});

export { extractBriefSkill };
