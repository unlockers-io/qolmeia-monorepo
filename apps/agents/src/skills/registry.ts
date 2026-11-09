import { log } from "@repo/observability";
import type { SkillCatalogEntry, SkillId } from "@repo/worker-api/contracts";
import { tool, type ToolSet } from "ai";

import type { Db } from "#/lib/db";
import { listAssetsSkill, readAssetSkill, saveAssetSkill } from "#/skills/assets";
import { delegateToWorkerSkill } from "#/skills/delegate-to-worker";
import { draftSocialPostSkill } from "#/skills/draft-social-post";
import { extractBriefSkill } from "#/skills/extract-brief";
import { fetchUrlSkill } from "#/skills/fetch-url";
import { generateBrandImageSkill } from "#/skills/generate-brand-image";
import { proposeTeamSkill } from "#/skills/propose-team";
import { recallMemorySkill } from "#/skills/recall-memory";
import { rememberFactSkill } from "#/skills/remember-fact";
import type { Skill, SkillContext, SkillInput, SkillResult } from "#/skills/skill";
import { webSearchSkill } from "#/skills/web-search";

const SKILLS = {
  delegateToWorker: delegateToWorkerSkill,
  draftSocialPost: draftSocialPostSkill,
  extractBrief: extractBriefSkill,
  fetchUrl: fetchUrlSkill,
  generateBrandImage: generateBrandImageSkill,
  listAssets: listAssetsSkill,
  proposeTeam: proposeTeamSkill,
  readAsset: readAssetSkill,
  recallMemory: recallMemorySkill,
  rememberFact: rememberFactSkill,
  saveAsset: saveAssetSkill,
  webSearch: webSearchSkill,
} satisfies { [Id in SkillId]: Skill<Id> };

const ALL_SKILLS: ReadonlyArray<Skill> = Object.values(SKILLS);

const isKnownSkill = (id: string): id is SkillId => Object.hasOwn(SKILLS, id);

/** Template skill ids are checked on write; a stale one fails the job that reads it. */
const skillsFor = (skillIds: ReadonlyArray<string>): ReadonlyArray<Skill> =>
  skillIds.map((id) => {
    if (!isKnownSkill(id)) {
      throw new Error(`References unknown skill id: ${id}`);
    }

    return SKILLS[id];
  });

const listSkillCatalog = (): ReadonlyArray<SkillCatalogEntry> =>
  ALL_SKILLS.map(({ displayName, id }) => ({ displayName, id })).toSorted((a, b) =>
    a.displayName.localeCompare(b.displayName, "pt-BR"),
  );

const loadDisabledSkillIds = async (db: Db): Promise<Array<string>> => {
  const rows = await db.skill.findMany({ select: { id: true }, where: { enabled: false } });

  return rows.map(({ id }) => id);
};

const enabledSkills = (
  skills: ReadonlyArray<Skill>,
  disabledSkillIds: ReadonlyArray<string>,
): ReadonlyArray<Skill> => {
  const disabled = new Set(disabledSkillIds);

  return skills.filter(({ id }) => !disabled.has(id));
};

const previewResult = <Result extends SkillResult>(result: Result): Result | string => {
  if (typeof result === "string") {
    return result.slice(0, 200);
  }

  if (typeof result === "number" || typeof result === "boolean") {
    return String(result).slice(0, 200);
  }

  return result;
};

const runSkill = async (
  ctx: SkillContext,
  skill: Skill,
  input: SkillInput,
): Promise<SkillResult> => {
  const start = Date.now();

  const baseFields = {
    agentInstanceId: ctx.agentInstanceId,
    companyId: ctx.companyId,
    input: JSON.stringify(input),
    skillId: skill.id,
  };

  log.info({ ...baseFields, message: "agent.tool.start" });

  try {
    const result = await skill.execute(input, ctx);
    log.info({
      ...baseFields,
      durationMs: Date.now() - start,
      message: "agent.tool.ok",
      result: JSON.stringify(previewResult(result)),
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({
      ...baseFields,
      durationMs: Date.now() - start,
      error: message,
      message: "agent.tool.err",
    });
    throw error;
  }
};

const buildSkillTools = (
  ctx: SkillContext,
  skills: ReadonlyArray<Skill>,
  disabledSkillIds: ReadonlyArray<string>,
): ToolSet =>
  Object.fromEntries(
    enabledSkills(skills, disabledSkillIds).map((skill) => [
      skill.id,
      tool({
        description: skill.description,
        execute: (input) => runSkill(ctx, skill, input),
        inputSchema: skill.inputSchema,
      }),
    ]),
  );

export {
  buildSkillTools,
  enabledSkills,
  listSkillCatalog,
  loadDisabledSkillIds,
  runSkill,
  skillsFor,
};
