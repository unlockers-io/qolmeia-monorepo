import { useAgentStart, useModel, usePersistentState, useTool } from "@flue/runtime";
import { env } from "cloudflare:workers";

import { withDb } from "#/lib/db";
import { CONVERSATION_MODEL } from "#/lib/models";
import { buildFlueTools } from "#/skills/flue-tools";
import { loadDisabledSkillIds } from "#/skills/registry";
import type { Skill, SkillContext } from "#/skills/skill";

type ConversationAgent = {
  agentInstanceId: string;
  companyId: string;
  skills: ReadonlyArray<Skill>;
};

/** What every agent a Customer chats with shares: the model, the skill kill switch, and the skills. */
const useConversationAgent = ({ agentInstanceId, companyId, skills }: ConversationAgent): void => {
  const [disabledSkillIds, setDisabledSkillIds] = usePersistentState<ReadonlyArray<string>>(
    "disabledSkillIds",
    [],
  );

  useAgentStart(async () => {
    setDisabledSkillIds(await withDb(env, loadDisabledSkillIds));
  });

  useModel(CONVERSATION_MODEL, { thinkingLevel: "low" });

  const ctx: SkillContext = { agentInstanceId, companyId, deliverableFolder: "customer", env };

  for (const skillTool of buildFlueTools(ctx, skills, disabledSkillIds)) {
    useTool(skillTool);
  }
};

export { useConversationAgent };
