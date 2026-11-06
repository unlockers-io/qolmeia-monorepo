import type { AssetVisibility } from "@repo/db/worker";
import type { SkillId } from "@repo/worker-api/contracts";
import type { z } from "zod";

type SkillContext = {
  agentInstanceId: string;
  companyId: string;
  deliverableFolder: AssetVisibility;
  env: Env;
};

type SkillInput = Parameters<z.ZodType["parse"]>[0];

type SkillResult =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<SkillResult>
  | { readonly [key: string]: SkillResult | undefined };

type Skill<
  Id extends SkillId = SkillId,
  Schema extends z.ZodObject = z.ZodObject,
  Result extends SkillResult = SkillResult,
> = {
  description: string;
  displayName: string;
  execute: (input: SkillInput, ctx: SkillContext) => Promise<Result>;
  id: Id;
  inputSchema: Schema;
};

type SkillDefinition<
  Id extends SkillId,
  Schema extends z.ZodObject,
  Result extends SkillResult,
> = Omit<Skill<Id, Schema, Result>, "execute"> & {
  execute: (input: z.output<Schema>, ctx: SkillContext) => Promise<Result>;
};

const defineSkill = <
  const Id extends SkillId,
  Schema extends z.ZodObject,
  Result extends SkillResult,
>({
  execute,
  ...definition
}: SkillDefinition<Id, Schema, Result>): Skill<Id, Schema, Result> => ({
  ...definition,
  execute: async (input, ctx) => execute(definition.inputSchema.parse(input), ctx),
});

export { defineSkill };

export type { Skill, SkillContext, SkillInput, SkillResult };
