"use agent";
import {
  type AgentProps,
  useAgentStart,
  useModel,
  usePersistentState,
  useTool,
} from "@flue/runtime";
import { correspondentIdFor } from "@repo/worker-api/contracts";
import { env } from "cloudflare:workers";

import { withDb } from "#/lib/db";
import { CONVERSATION_MODEL } from "#/lib/models";
import { buildFlueTools } from "#/lib/skill-tool";
import { loadDisabledSkillIds } from "#/skills/registry";
import type { SkillContext } from "#/skills/skill";

const CORRESPONDENT_SKILLS = [
  "rememberFact",
  "recallMemory",
  "delegateToWorker",
  "extractBrief",
  "listAssets",
  "readAsset",
  "saveAsset",
  "webSearch",
  "fetchUrl",
];

const CORRESPONDENT_INSTRUCTIONS = `Você é o Correspondente da Qolmeia, o ponto único de contato de uma agência de IA para negócios. Fale português do Brasil, de forma calorosa, direta e profissional, como um gerente de conta atencioso.

Você tem um Time de especialistas. Quando o pedido exige uma especialidade (criar imagens, posts visuais, materiais de design), use a skill delegateToWorker com o workerKind apropriado (ex: "designer"). Diga ao cliente que o especialista vai cuidar disso e que você avisa quando o resultado estiver pronto; não prometa prazo específico. O cliente NUNCA precisa aprovar nada: aprovações são feitas internamente pela equipe da Qolmeia, e a entrega final aparece no chat automaticamente quando estiver pronta.

Ao mostrar imagens geradas, inclua a URL no formato markdown ![descrição curta](URL) para que apareça inline no chat.

Use recallMemory no início de pedidos relevantes para lembrar o que já sabe sobre o cliente, e rememberFact para guardar fatos novos importantes.`;

export function CorrespondentV2({ id }: AgentProps): string {
  const [disabledSkillIds, setDisabledSkillIds] = usePersistentState<ReadonlyArray<string>>(
    "disabledSkillIds",
    [],
  );
  useAgentStart(async () => {
    setDisabledSkillIds(await withDb(env, loadDisabledSkillIds));
  });

  useModel(CONVERSATION_MODEL, { thinkingLevel: "low" });

  const ctx: SkillContext = {
    agentInstanceId: correspondentIdFor(id),
    companyId: id,
    deliverableFolder: "customer",
    env,
  };
  for (const skillTool of buildFlueTools(ctx, CORRESPONDENT_SKILLS, disabledSkillIds)) {
    useTool(skillTool);
  }

  return CORRESPONDENT_INSTRUCTIONS;
}
