import type { Model } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

const CONVERSATION_MODEL = "anthropic/claude-sonnet-5.5";

// Pi's bundled catalog predates this release. Keep the built-in transport,
// credentials and alternate models, and add the verified OpenRouter metadata.
// Source: https://openrouter.ai/api/v1/models (2026-09-29).
const sonnet: Model<"openai-completions"> = {
  api: "openai-completions",
  baseUrl: "https://openrouter.ai/api/v1",
  contextWindow: 1_000_000,
  cost: { cacheRead: 0.2, cacheWrite: 2.5, input: 2, output: 10 },
  id: CONVERSATION_MODEL,
  input: ["text", "image"],
  maxTokens: 128_000,
  name: "Claude Sonnet 5.5",
  provider: "openrouter",
  reasoning: true,
};

const builtin = openrouterProvider();
const conversationProvider = {
  ...builtin,
  getModels: () => [...builtin.getModels().filter((model) => model.id !== sonnet.id), sonnet],
};

export { CONVERSATION_MODEL, conversationProvider };
