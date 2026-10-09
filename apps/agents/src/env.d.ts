interface Env {
  AI?: Ai;
  BETTER_AUTH_SECRET: string;
  EXA_API_KEY?: string;
  FIRECRAWL_API_KEY?: string;
  FIRECRAWL_BASE_URL?: string;
  OPENROUTER_API_KEY: string;
  RESEND_API_KEY?: string;
  TRUSTED_PROXY_SECRET?: string;
  VECTORIZE?: VectorizeIndex;
}

namespace Cloudflare {
  // oxlint-disable-next-line no-shadow -- Cloudflare.Env declaration merging requires the same name as the global Env
  interface Env {
    AI?: Ai;
    BETTER_AUTH_SECRET: string;
    EXA_API_KEY?: string;
    FIRECRAWL_API_KEY?: string;
    FIRECRAWL_BASE_URL?: string;
    OPENROUTER_API_KEY: string;
    RESEND_API_KEY?: string;
    TRUSTED_PROXY_SECRET?: string;
    VECTORIZE?: VectorizeIndex;
  }
}
