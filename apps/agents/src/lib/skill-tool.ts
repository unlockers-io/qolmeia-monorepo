import { defineTool, type ToolDefinition, type ToolInputSchema } from "@flue/runtime";
import * as v from "valibot";
import * as z from "zod";
import type { ZodType } from "zod";

import { enabledSkills, runSkill } from "#/skills/registry";
import type { SkillContext } from "#/skills/skill";

type JsonSchemaNode = z.core.JSONSchema._JSONSchema;

type SchemaObject = z.core.JSONSchema.JSONSchema;

type AnySchema = v.GenericSchema<unknown, unknown>;

const describe = (schema: AnySchema, description: string | undefined): AnySchema =>
  description === undefined ? schema : v.pipe(schema, v.description(description));

const convertString = (node: SchemaObject): AnySchema => {
  let schema: v.GenericSchema<string, string> = v.string();
  if (node.minLength !== undefined) {
    schema = v.pipe(schema, v.minLength(node.minLength));
  }
  if (node.maxLength !== undefined) {
    schema = v.pipe(schema, v.maxLength(node.maxLength));
  }
  if (node.format === "uri") {
    schema = v.pipe(schema, v.url());
  }
  return schema;
};

const convertEnum = (values: ReadonlyArray<unknown>, path: string): AnySchema => {
  const options = values.filter((value): value is string => typeof value === "string");
  if (options.length === 0 || options.length !== values.length) {
    throw new Error(`Skill input schema: unsupported non-string enum at ${path}`);
  }
  return v.picklist(options);
};

type ConvertNode = (node: JsonSchemaNode, path: string) => AnySchema;

const convertObject = (
  node: SchemaObject,
  path: string,
  convertChild: ConvertNode,
): v.ObjectSchema<v.ObjectEntries, undefined> => {
  const required = new Set(node.required);
  const entries: v.ObjectEntries = {};
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    const converted = convertChild(child, `${path}.${key}`);
    entries[key] = required.has(key) ? converted : v.optional(converted);
  }
  return v.object(entries);
};

const convert: ConvertNode = (node, path) => {
  if (typeof node === "boolean") {
    throw new TypeError(`Skill input schema: unsupported boolean schema at ${path}`);
  }
  if (node.enum !== undefined) {
    return describe(convertEnum(node.enum, path), node.description);
  }
  if (Array.isArray(node.type)) {
    throw new TypeError(`Skill input schema: unsupported multi-type node at ${path}`);
  }
  switch (node.type) {
    case "array": {
      if (node.items === undefined || Array.isArray(node.items)) {
        throw new TypeError(`Skill input schema: array without a single items schema at ${path}`);
      }
      return describe(v.array(convert(node.items, `${path}[]`)), node.description);
    }
    case "boolean": {
      return describe(v.boolean(), node.description);
    }
    case "integer":
    case "number": {
      return describe(v.number(), node.description);
    }
    case "object": {
      return describe(convertObject(node, path, convert), node.description);
    }
    case "string": {
      return describe(convertString(node), node.description);
    }
    case undefined: {
      throw new Error(`Skill input schema: unsupported node without a type at ${path}`);
    }
    case "null": {
      throw new Error(`Skill input schema: unsupported null node at ${path}`);
    }
    default: {
      throw new Error(`Skill input schema: unsupported node at ${path}`);
    }
  }
};

const buildInputSchema = (schema: ZodType, skillId: string): ToolInputSchema => {
  const node = z.toJSONSchema(schema);
  if (node.type !== "object") {
    throw new Error(`Skill "${skillId}" input schema must be a top-level object`);
  }
  return convertObject(node, skillId, convert);
};

const buildFlueTools = (
  ctx: SkillContext,
  skillIds: ReadonlyArray<string>,
  disabledSkillIds: ReadonlyArray<string>,
): Array<ToolDefinition> =>
  enabledSkills(skillIds, disabledSkillIds).map((skill) =>
    defineTool({
      description: skill.description,
      input: buildInputSchema(skill.inputSchema, skill.id),
      name: skill.id,
      run: async ({ data }) => ({ output: await runSkill(ctx, skill, data) }),
    }),
  );

export { buildFlueTools, buildInputSchema };
