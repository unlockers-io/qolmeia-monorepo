import { log } from "@repo/observability";
import { briefCompleteness } from "@repo/worker-api/brief";

import { recordActivity } from "#/activity/log";
import type { ActivityEvent } from "#/activity/types";
import { listActiveCompanies } from "#/company/company";
import { signalCorrespondent } from "#/conversation/signal";
import { withDb, type Db, type PrismaClient } from "#/lib/db";
import { correspondentIdFor } from "#/team/ids";

/** Shorter than the weekly cron period, so the next week's run is never inside the window. */
const PROACTIVE_INTERVAL_MS = 6 * 24 * 60 * 60 * 1000;

const PROACTIVE_PROMPT = `Esta é uma mensagem proativa que VOCÊ está iniciando; o cliente não perguntou nada agora. Com base no brief da empresa, sugira de 2 a 3 entregas concretas e específicas para esta semana (por exemplo: posts para redes, peças de design, ações de marketing). Seja breve e caloroso, conecte cada ideia ao negócio do cliente, e convide-o a confirmar para você já acionar o especialista.`;

const proactiveGate = (lastSuggestedAt: number | null, now: number): boolean =>
  lastSuggestedAt === null || now - lastSuggestedAt >= PROACTIVE_INTERVAL_MS;

const lastProactiveSuggestionAt = async (db: Db, companyId: string): Promise<number | null> => {
  const row = await db.activityLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: { companyId, type: "WORKER_PROACTIVE_SUGGESTION" satisfies ActivityEvent["type"] },
  });

  return row?.createdAt.getTime() ?? null;
};

const recordProactiveSuggestion = (db: Db, companyId: string): Promise<void> =>
  recordActivity(db, {
    companyId,
    refId: correspondentIdFor(companyId),
    refType: "agent_instance",
    summary: "Sugestão proativa de trabalho enviada ao cliente.",
    type: "WORKER_PROACTIVE_SUGGESTION",
  });

type SweepResult = { errored: number; skipped: number; suggested: number };

const sweep = async (db: PrismaClient, scheduledTime: number): Promise<SweepResult> => {
  const results = await listActiveCompanies(db);
  const eligible = results.filter((row) => briefCompleteness(row.brief).isComplete);

  const outcomes = await Promise.allSettled(
    eligible.map(async (company): Promise<"skipped" | "suggested"> => {
      if (!proactiveGate(await lastProactiveSuggestionAt(db, company.id), scheduledTime)) {
        return "skipped";
      }

      await signalCorrespondent(company.id, {
        body: PROACTIVE_PROMPT,
        idempotencyKey: `proactive.nudge:${company.id}:${scheduledTime}`,
        type: "proactive.nudge",
      });
      await recordProactiveSuggestion(db, company.id);

      return "suggested";
    }),
  );

  let suggested = 0;
  let skipped = 0;
  let errored = 0;

  for (const [index, outcome] of outcomes.entries()) {
    if (outcome.status === "rejected") {
      errored += 1;
      log.error({
        companyId: eligible[index]?.id,
        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        message: "agent.proactiveSweep.company.err",
      });
    } else if (outcome.value === "suggested") {
      suggested += 1;
    } else {
      skipped += 1;
    }
  }

  log.info({
    eligible: eligible.length,
    errored,
    message: "agent.proactiveSweep.done",
    scanned: results.length,
    skipped,
    suggested,
  });

  return { errored, skipped, suggested };
};

const runProactiveSweep = (env: Env, scheduledTime: number): Promise<SweepResult> =>
  withDb(env, (db) => sweep(db, scheduledTime));

export {
  lastProactiveSuggestionAt,
  PROACTIVE_INTERVAL_MS,
  proactiveGate,
  recordProactiveSuggestion,
  runProactiveSweep,
};
