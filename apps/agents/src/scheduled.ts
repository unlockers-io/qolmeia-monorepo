import { dispatch } from "@flue/runtime";
import { log } from "@repo/observability";
import { briefCompleteness } from "@repo/worker-api/brief";

import { CorrespondentV2 } from "#/agents/correspondent";
import { listActiveCompanies } from "#/company/company";
import { withDb, type PrismaClient } from "#/lib/db";
import {
  lastProactiveSuggestionAt,
  PROACTIVE_PROMPT,
  proactiveGate,
  recordProactiveSuggestion,
} from "#/lib/proactive";

type SweepResult = { errored: number; skipped: number; suggested: number };

const sweep = async (db: PrismaClient): Promise<SweepResult> => {
  const results = await listActiveCompanies(db);

  const eligible = results.filter((row) => briefCompleteness(row.brief).isComplete);

  const outcomes = await Promise.allSettled(
    eligible.map(async (company): Promise<"skipped" | "suggested"> => {
      const gate = proactiveGate({
        isComplete: true,
        lastSuggestedAt: await lastProactiveSuggestionAt(db, company.id),
        now: Date.now(),
      });
      if (!gate.ok) {
        return "skipped";
      }
      await dispatch(CorrespondentV2, {
        id: company.id,
        message: { body: PROACTIVE_PROMPT, kind: "signal", type: "proactive.nudge" },
      });
      await recordProactiveSuggestion(db, company.id);
      return "suggested";
    }),
  );

  let suggested = 0;
  let skipped = 0;
  let errored = 0;
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      errored += 1;
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

const runProactiveSweep = (env: Env): Promise<SweepResult> => withDb(env, sweep);

export { runProactiveSweep };
