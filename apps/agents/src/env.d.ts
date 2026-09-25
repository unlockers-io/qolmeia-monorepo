interface Env {
  AI?: Ai;
  API_INTERNAL_URL: string;
  ASSETS_SIGNING_KEY: string;
  EXA_API_KEY?: string;
  FIRECRAWL_API_KEY?: string;
  FIRECRAWL_BASE_URL?: string;
  INTERNAL_SHARED_SECRET: string;
  OPENROUTER_API_KEY: string;
  VECTORIZE?: VectorizeIndex;
}

namespace Cloudflare {
  // oxlint-disable-next-line no-shadow -- Cloudflare.Env declaration merging requires the same name as the global Env
  interface Env {
    AI?: Ai;
    ASSETS_SIGNING_KEY: string;
    EXA_API_KEY?: string;
    FIRECRAWL_API_KEY?: string;
    FIRECRAWL_BASE_URL?: string;
    INTERNAL_SHARED_SECRET: string;
    OPENROUTER_API_KEY: string;
    VECTORIZE?: VectorizeIndex;
  }
}
