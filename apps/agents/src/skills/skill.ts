import type { AssetVisibility } from "@repo/db/worker";
import type { z } from "zod";

type SkillContext = {
  agentInstanceId: string;
  companyId: string;
  deliverableFolder: AssetVisibility;
  env: Env;
};

type SkillInput = Parameters<z.ZodType["parse"]>[0];

type SkillResult = boolean | null | number | object | string;

type Skill<Schema extends z.ZodObject = z.ZodObject, Result extends SkillResult = SkillResult> = {
  description: string;
  displayName: string;
  execute: (input: SkillInput, ctx: SkillContext) => Promise<Result>;
  id: string;
  inputSchema: Schema;
};

type SkillDefinition<Schema extends z.ZodObject, Result extends SkillResult> = Omit<
  Skill<Schema, Result>,
  "execute"
> & {
  execute: (input: z.output<Schema>, ctx: SkillContext) => Promise<Result>;
};

const defineSkill = <Schema extends z.ZodObject, Result extends SkillResult>({
  execute,
  ...definition
}: SkillDefinition<Schema, Result>): Skill<Schema, Result> => ({
  ...definition,
  execute: async (input, ctx) => execute(definition.inputSchema.parse(input), ctx),
});

export { defineSkill };
export type { Skill, SkillContext, SkillInput, SkillResult };
