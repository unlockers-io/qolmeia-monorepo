import type { WorkerJobParams } from "#/jobs/worker-job";
import type { TeamEvents } from "#/team/team-events";

declare global {
  interface Env {
    AI?: Ai;
    BETTER_AUTH_SECRET: string;
    EXA_API_KEY?: string;
    FIRECRAWL_API_KEY?: string;
    FIRECRAWL_BASE_URL?: string;
    OPENROUTER_API_KEY: string;
    RESEND_API_KEY?: string;
    TEAM_EVENTS: DurableObjectNamespace<TeamEvents>;
    TRUSTED_PROXY_SECRET?: string;
    VECTORIZE?: VectorizeIndex;
    WORKER_JOB: Workflow<WorkerJobParams>;
  }

  namespace Cloudflare {
    interface Env {
      AI?: Ai;
      BETTER_AUTH_SECRET: string;
      EXA_API_KEY?: string;
      FIRECRAWL_API_KEY?: string;
      FIRECRAWL_BASE_URL?: string;
      OPENROUTER_API_KEY: string;
      RESEND_API_KEY?: string;
      TEAM_EVENTS: DurableObjectNamespace<TeamEvents>;
      TRUSTED_PROXY_SECRET?: string;
      VECTORIZE?: VectorizeIndex;
      WORKER_JOB: Workflow<WorkerJobParams>;
    }
  }
}
