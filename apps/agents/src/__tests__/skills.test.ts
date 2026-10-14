import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { recallMemorySkill } from "#/skills/recall-memory";
import type { SkillContext } from "#/skills/registry";
import { rememberFactSkill } from "#/skills/remember-fact";

const COMPANY_ID = "co_skills_test";
const AGENT_INSTANCE_ID = "agent_skills_test";

const ctx: SkillContext = {
  agentInstanceId: AGENT_INSTANCE_ID,
  companyId: COMPANY_ID,
  deliverableFolder: "customer",
  get env() {
    return env;
  },
};

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
  await db((client) =>
    client.agentInstance.create({
      data: {
        companyId: COMPANY_ID,
        displayName: "Test Correspondent",
        id: AGENT_INSTANCE_ID,
        role: "correspondent",
      },
    }),
  );
});

describe("rememberFact", () => {
  it("writes a memory_fact row and returns an id + timestamp", async () => {
    const result = (await rememberFactSkill.execute(
      { content: "minha cor preferida é azul", kind: "preference" },
      ctx,
    )) as { id: string; savedAt: number };

    expect(result.id).toBeTruthy();
    expect(result.savedAt).toBeGreaterThan(0);

    const row = await db((client) =>
      client.memoryFact.findUnique({
        select: { content: true, kind: true },
        where: { id: result.id },
      }),
    );
    expect(row).toEqual({ content: "minha cor preferida é azul", kind: "preference" });
  });
});

describe("recallMemory", () => {
  it("returns facts upserted by rememberFact for the same agent", async () => {
    await rememberFactSkill.execute(
      { content: "minha cor preferida é azul marinho", kind: "preference" },
      ctx,
    );
    const result = (await recallMemorySkill.execute({ query: "minha cor preferida" }, ctx)) as {
      matches: ReadonlyArray<{ content: string }>;
    };
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.some((m) => m.content.includes("azul marinho"))).toBe(true);
  });
});
