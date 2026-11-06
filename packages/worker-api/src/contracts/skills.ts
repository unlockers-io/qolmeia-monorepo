const SKILL_IDS = [
  "delegateToWorker",
  "draftSocialPost",
  "extractBrief",
  "fetchUrl",
  "generateBrandImage",
  "listAssets",
  "proposeTeam",
  "readAsset",
  "recallMemory",
  "rememberFact",
  "saveAsset",
  "webSearch",
] as const;

type SkillId = (typeof SKILL_IDS)[number];

export { SKILL_IDS };

export type { SkillId };
