import { log } from "@repo/observability";
import { correspondentIdFor } from "@repo/worker-api/contracts";

import { recordActivity } from "#/activity/log";
import type { Db } from "#/lib/db";

const PROACTIVE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

const PROACTIVE_PROMPT = `Esta é uma mensagem proativa que VOCÊ está iniciando; o cliente não perguntou nada agora. Com base no brief da empresa, sugira de 2 a 3 entregas concretas e específicas para esta semana (por exemplo: posts para redes, peças de design, ações de marketing). Seja breve e caloroso, conecte cada ideia ao negócio do cliente, e convide-o a confirmar para você já acionar o especialista.`;

const proactiveGate = (input: {
  isComplete: boolean;
  lastSuggestedAt: number | null;
  now: number;
}) => {
  if (!input.isComplete) {
    return { ok: false, reason: "brief incomplete" };
  }
  if (input.lastSuggestedAt !== null && input.now - input.lastSuggestedAt < PROACTIVE_INTERVAL_MS) {
    return { ok: false, reason: "suggested recently" };
  }
  return { ok: true, reason: "" };
};

const lastProactiveSuggestionAt = async (db: Db, companyId: string): Promise<number | null> => {
  const row = await db.activityLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: { companyId, type: "WORKER_PROACTIVE_SUGGESTION" },
  });
  return row?.createdAt.getTime() ?? null;
};

const recordProactiveSuggestion = async (db: Db, companyId: string): Promise<void> => {
  try {
    await recordActivity(db, {
      companyId,
      refId: correspondentIdFor(companyId),
      refType: "agent_instance",
      summary: "Sugestão proativa de trabalho enviada ao cliente.",
      type: "WORKER_PROACTIVE_SUGGESTION",
    });
  } catch (error) {
    log.error({
      companyId,
      error: error instanceof Error ? error.message : String(error),
      message: "activity.write_failed",
      type: "WORKER_PROACTIVE_SUGGESTION",
    });
  }
};

export {
  lastProactiveSuggestionAt,
  PROACTIVE_INTERVAL_MS,
  PROACTIVE_PROMPT,
  proactiveGate,
  recordProactiveSuggestion,
};
