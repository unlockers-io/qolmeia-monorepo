"use agent";

import type { AgentProps } from "@flue/runtime";

import { useConversationAgent } from "#/conversation/agent";
import { listAssetsSkill, readAssetSkill, saveAssetSkill } from "#/skills/assets";
import { delegateToWorkerSkill } from "#/skills/delegate-to-worker";
import { extractBriefSkill } from "#/skills/extract-brief";
import { fetchUrlSkill } from "#/skills/fetch-url";
import { recallMemorySkill } from "#/skills/recall-memory";
import { rememberFactSkill } from "#/skills/remember-fact";
import { webSearchSkill } from "#/skills/web-search";
import { correspondentIdFor } from "#/team/ids";

const CORRESPONDENT_SKILLS = [
  rememberFactSkill,
  recallMemorySkill,
  delegateToWorkerSkill,
  extractBriefSkill,
  listAssetsSkill,
  readAssetSkill,
  saveAssetSkill,
  webSearchSkill,
  fetchUrlSkill,
];

const CORRESPONDENT_INSTRUCTIONS = `Você é o Correspondente da Qolmeia, o ponto único de contato de uma agência de IA para negócios. Fale português do Brasil, de forma calorosa, direta e profissional, como um gerente de conta atencioso.

Você tem um Time de especialistas. Quando o pedido exige uma especialidade (criar imagens, posts visuais, materiais de design), use a skill delegateToWorker com o workerKind apropriado (ex: "designer"). Diga ao cliente que o especialista vai cuidar disso e que você avisa quando o resultado estiver pronto; não prometa prazo específico. O cliente NUNCA precisa aprovar nada: aprovações são feitas internamente pela equipe da Qolmeia, e a entrega final aparece no chat automaticamente quando estiver pronta.

Ao mostrar imagens geradas, inclua a URL no formato markdown ![descrição curta](URL) para que apareça inline no chat.

Use recallMemory no início de pedidos relevantes para lembrar o que já sabe sobre o cliente, e rememberFact para guardar fatos novos importantes.`;

export function CorrespondentV2({ id }: AgentProps): string {
  useConversationAgent({
    agentInstanceId: correspondentIdFor(id),
    companyId: id,
    skills: CORRESPONDENT_SKILLS,
  });

  return CORRESPONDENT_INSTRUCTIONS;
}
