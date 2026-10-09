import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { extractBriefSkill } from "#/skills/extract-brief";
import type { SkillContext } from "#/skills/skill";

const COMPANY_ID = "co_extract_test";

const ctx: SkillContext = {
  agentInstanceId: `planner-${COMPANY_ID}`,
  companyId: COMPANY_ID,
  deliverableFolder: "customer",
  get env() {
    return env;
  },
};

const storedBrief = async () => {
  const row = await db((client) =>
    client.company.findUnique({ select: { brief: true }, where: { id: COMPANY_ID } }),
  );
  return row?.brief;
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, status: "onboarding" });
});

describe("extractBrief", () => {
  it("writes the first partial brief to company.brief", async () => {
    const result = await extractBriefSkill.execute({ industry: "cafeteria" }, ctx);
    expect(result.brief.industry).toBe("cafeteria");
    await expect(storedBrief()).resolves.toMatchObject({ industry: "cafeteria" });
  });

  it("merges sequential calls without overwriting earlier fields", async () => {
    await extractBriefSkill.execute({ industry: "cafeteria" }, ctx);
    await extractBriefSkill.execute({ audience: "jovens profissionais" }, ctx);
    await extractBriefSkill.execute({ primaryGoal: "dobrar vendas" }, ctx);

    await expect(storedBrief()).resolves.toMatchObject({
      audience: "jovens profissionais",
      industry: "cafeteria",
      primaryGoal: "dobrar vendas",
    });
  });
});
