import { log } from "@repo/observability";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import type { Generation } from "#/action/action-type";
import type { Verdict } from "#/action/approval";
import { decisionEventType, type DecisionEvent } from "#/jobs/decision";
import { generateDeliverable, type Revision } from "#/jobs/worker-job-generate";
import {
  applyDecision,
  executeAction,
  type JobContext,
  proposeDeliverable,
  type Proposal,
} from "#/jobs/worker-job-steps";

type WorkerJobParams = {
  agentInstanceId: string;
  companyId: string;
  ticketId: string;
};

type WorkerJobResult = { actionId: string; outcome: "ended" | "executed"; revisions: number };

class WorkerJobWorkflow extends WorkflowEntrypoint<Env, WorkerJobParams> {
  async run(
    event: Readonly<WorkflowEvent<WorkerJobParams>>,
    step: WorkflowStep,
  ): Promise<WorkerJobResult> {
    const job: JobContext = { ...event.payload, env: this.env };
    const workflowStart = Date.now();
    const finish = (result: WorkerJobResult): WorkerJobResult => {
      log.info({
        ...result,
        companyId: job.companyId,
        durationMs: Date.now() - workflowStart,
        message: "workflow.done",
        ticketId: job.ticketId,
      });
      return result;
    };

    log.info({ ...event.payload, message: "workflow.start" });

    let revision: Revision | null = null;
    for (let round = 0; ; round += 1) {
      const priorRevision = revision;
      const generation = await step.do(`generate-${round}`, (): Promise<Generation> =>
        generateDeliverable(job, round, priorRevision),
      );
      const proposal = await step.do(`propose-${round}`, (): Promise<Proposal> =>
        proposeDeliverable(job, round, priorRevision?.feedback ?? null, generation),
      );

      if (proposal.policy === "require_approval") {
        log.info({
          actionId: proposal.actionId,
          companyId: job.companyId,
          message: "workflow.waiting",
          revision: round,
          ticketId: job.ticketId,
        });
        const decision = await step.waitForEvent<DecisionEvent>(`wait-${round}`, {
          timeout: "60 days",
          type: decisionEventType(proposal.actionId),
        });
        const verdict = await step.do(`decide-${round}`, (): Promise<Verdict> =>
          applyDecision(job, proposal, round, decision.payload),
        );
        if (verdict === "end") {
          return finish({ actionId: proposal.actionId, outcome: "ended", revisions: round });
        }
        if (verdict === "revise") {
          revision = {
            feedback: decision.payload.feedback ?? null,
            priorSummary: generation.summary,
          };
          continue;
        }
      }

      await step.do(`execute-${round}`, (): Promise<void> => executeAction(job, proposal));
      return finish({ actionId: proposal.actionId, outcome: "executed", revisions: round });
    }
  }
}

export { WorkerJobWorkflow };
export type { WorkerJobParams, WorkerJobResult };
