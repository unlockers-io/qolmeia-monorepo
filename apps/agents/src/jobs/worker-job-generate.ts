import { log } from "@repo/observability";
import { generateText, isStepCount } from "ai";

import type { Generation } from "#/action/action-type";
import type { JobContext } from "#/jobs/worker-job-steps";
import { withDb } from "#/lib/db";
import { languageModel } from "#/lib/models";
import { buildSkillTools } from "#/skills/registry";
import { resolveSystemPrompt } from "#/team/resolve-system-prompt";
import { loadInstanceWithTemplate, loadTicket } from "#/ticket/ticket";

type ChatMessage = { content: string; role: "assistant" | "user" };

const buildRevisionMessages = (
  brief: string,
  priorSummary: string | null,
  feedback: string | null,
): Array<ChatMessage> => {
  const messages: Array<ChatMessage> = [{ content: brief, role: "user" }];
  if (priorSummary !== null && priorSummary !== "" && feedback !== null && feedback !== "") {
    messages.push(
      { content: priorSummary, role: "assistant" },
      {
        content: `O revisor (operador da Qolmeia) pediu ajustes na entrega anterior:\n\n"${feedback}"\n\nRefaça o trabalho incorporando o pedido. Mantenha o que já estava bom e entregue a versão revisada.`,
        role: "user",
      },
    );
  }
  return messages;
};

type Revision = { feedback: string | null; priorSummary: string };

const generateDeliverable = async (
  job: JobContext,
  round: number,
  revision: Revision | null,
): Promise<Generation> => {
  const { agentInstanceId, companyId, env, ticketId } = job;
  const stepStart = Date.now();
  const [ticket, { agentInstance, template }] = await withDb(env, (db) =>
    Promise.all([loadTicket(db, ticketId), loadInstanceWithTemplate(db, agentInstanceId)]),
  );
  if (ticket === null) {
    throw new Error(`ticket ${ticketId} not properly seeded`);
  }
  log.info({
    agentInstanceId,
    brief: ticket.brief,
    companyId,
    message: "workflow.generate.start",
    model: template.model,
    revision: round,
    skillIds: template.skillIds,
    templateId: template.id,
    ticketId,
  });
  const tools = await buildSkillTools(
    { agentInstanceId: agentInstance.id, companyId, deliverableFolder: "agent", env },
    template.skillIds,
  );
  const result = await generateText({
    instructions: resolveSystemPrompt(agentInstance, template),
    messages: buildRevisionMessages(
      ticket.brief,
      revision?.priorSummary ?? null,
      revision?.feedback ?? null,
    ),
    model: languageModel(env, template.model),
    stopWhen: isStepCount(5),
    tools,
  });
  const summary = result.text.trim();
  const outputs = result.steps.flatMap(({ toolResults }) =>
    toolResults.map(({ output, toolName }) => ({
      json: JSON.stringify(output ?? null),
      tool: toolName,
    })),
  );
  log.info({
    agentInstanceId,
    companyId,
    durationMs: Date.now() - stepStart,
    message: "workflow.generate.ok",
    replyText: summary,
    revision: round,
    ticketId,
    toolCallNames: result.steps.flatMap((s) => s.toolCalls.map((tc) => tc.toolName)),
    toolOutputNames: outputs.map(({ tool }) => tool),
    usage: result.usage,
  });
  return { outputs, summary };
};

export { buildRevisionMessages, generateDeliverable };
export type { Revision };
