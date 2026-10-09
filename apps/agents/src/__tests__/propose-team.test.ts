import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { proposeTeamSkill } from "#/skills/propose-team";
import type { SkillContext } from "#/skills/registry";
import { entitleToActiveTemplates } from "#/template/template";

const COMPANY_ID = "co_propose_test";

const ctx: SkillContext = {
  agentInstanceId: `planner-${COMPANY_ID}`,
  companyId: COMPANY_ID,
  get env() {
    return env;
  },
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, status: "onboarding" });
  await db((client) => entitleToActiveTemplates(client, COMPANY_ID));
});

describe("proposeTeam", () => {
  it("returns the entitled catalog as candidates", async () => {
    const result = (await proposeTeamSkill.execute({}, ctx)) as {
      brief: Record<string, unknown>;
      candidates: ReadonlyArray<{ id: string; workerKind: string }>;
    };
    expect(result.candidates.some((c) => c.id === "tpl-designer")).toBe(true);
    expect(result.candidates.every((c) => c.workerKind.length > 0)).toBe(true);
  });

  it("includes the brief so the Planner can present it back to the user", async () => {
    await db((client) =>
      client.company.update({
        data: { brief: { industry: "alimentação" } },
        where: { id: COMPANY_ID },
      }),
    );
    const result = (await proposeTeamSkill.execute({}, ctx)) as {
      brief: { industry?: string };
    };
    expect(result.brief.industry).toBe("alimentação");
  });
});
