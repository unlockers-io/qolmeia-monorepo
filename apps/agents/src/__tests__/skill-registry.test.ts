import type { ToolDefinition } from "@flue/runtime";
import { DEFAULT_TEMPLATES } from "@repo/db/worker";
import { asSchema, type JSONSchema7 } from "ai";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { db } from "#/__tests__/fixtures";
import { buildFlueTools } from "#/lib/skill-tool";
import { delegateToWorkerSkill } from "#/skills/delegate-to-worker";
import {
  buildSkillTools,
  isKnownSkill,
  listSkillCatalog,
  loadDisabledSkillIds,
} from "#/skills/registry";
import type { SkillContext } from "#/skills/skill";

const ctx: SkillContext = {
  agentInstanceId: "agent_registry_test",
  companyId: "co_registry_test",
  deliverableFolder: "customer",
  env,
};

type Fields = Record<string, { description: string | undefined; required: boolean }>;

const jsonSchemaFields = (schema: JSONSchema7): Fields =>
  Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, property]) => [
      key,
      {
        description: (property as JSONSchema7).description,
        required: schema.required?.includes(key) ?? false,
      },
    ]),
  );

const flueFields = (input: ToolDefinition["input"]): Fields =>
  Object.fromEntries(
    Object.entries((input as v.ObjectSchema<v.ObjectEntries, undefined>).entries).map(
      ([key, entry]) => {
        const required = entry.type !== "optional";
        const field = required
          ? entry
          : (entry as v.OptionalSchema<v.GenericSchema, undefined>).wrapped;
        return [key, { description: v.getDescription(field), required }];
      },
    ),
  );

const flueToolIds = (skillIds: ReadonlyArray<string>, disabled: ReadonlyArray<string>) =>
  buildFlueTools(ctx, skillIds, disabled).map(({ name }) => name);

const aiToolIds = (skillIds: ReadonlyArray<string>, disabled: ReadonlyArray<string>) =>
  Object.keys(buildSkillTools(ctx, skillIds, disabled));

describe("skill definitions", () => {
  const catalog = listSkillCatalog();
  const skillIds = catalog.map(({ id }) => id);

  it("give the Flue agents, the AI SDK, and the backoffice catalog one contract", async () => {
    const flueTools = buildFlueTools(ctx, skillIds, []);
    const aiTools = buildSkillTools(ctx, skillIds, []);
    expect(flueTools.map(({ name }) => name)).toEqual(skillIds);
    expect(Object.keys(aiTools)).toEqual(skillIds);

    for (const entry of catalog) {
      const flueTool = flueTools.find(({ name }) => name === entry.id);
      const aiTool = aiTools[entry.id];
      if (!flueTool || !aiTool?.inputSchema) {
        throw new Error(`${entry.id} is missing an adapter`);
      }
      expect(entry.displayName).not.toBe("");
      expect(flueTool.description).toBe(entry.description);
      expect(aiTool.description).toBe(entry.description);

      expect(flueFields(flueTool.input)).toEqual(
        jsonSchemaFields(await asSchema(aiTool.inputSchema).jsonSchema),
      );
    }
  });

  it("parses input against the definition before execute runs", async () => {
    await expect(
      delegateToWorkerSkill.execute({ brief: "", workerKind: "designer" }, ctx),
    ).rejects.toThrow(z.ZodError);
  });

  it("every seeded template references only known skills", () => {
    const templateSkillIds = DEFAULT_TEMPLATES.flatMap(({ skillIds: ids }) => ids);
    expect(templateSkillIds.filter((id) => !isKnownSkill(id))).toEqual([]);
  });

  it("throws on an unknown skill id in both adapters", () => {
    expect(() => buildFlueTools(ctx, ["nope-not-a-skill"], [])).toThrow(/unknown skill id/v);
    expect(() => buildSkillTools(ctx, ["nope-not-a-skill"], [])).toThrow(/unknown skill id/v);
  });
});

describe("skill kill-switch", () => {
  const skillIds = ["webSearch", "fetchUrl", "saveAsset"];

  it("treats a missing row as enabled", async () => {
    const disabled = await db(loadDisabledSkillIds);
    expect(disabled).toEqual([]);
    expect(flueToolIds(skillIds, disabled)).toEqual(skillIds);
    expect(aiToolIds(skillIds, disabled)).toEqual(skillIds);
  });

  it("drops a disabled skill from both adapters and keeps enabled rows", async () => {
    await db((client) =>
      client.skill.createMany({
        data: [
          { enabled: false, id: "webSearch" },
          { enabled: true, id: "fetchUrl" },
        ],
      }),
    );
    const disabled = await db(loadDisabledSkillIds);
    expect(disabled).toEqual(["webSearch"]);
    expect(flueToolIds(skillIds, disabled)).toEqual(["fetchUrl", "saveAsset"]);
    expect(aiToolIds(skillIds, disabled)).toEqual(["fetchUrl", "saveAsset"]);
  });
});
