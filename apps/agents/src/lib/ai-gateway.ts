import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";

const OPENROUTER_DIRECT_URL = "https://openrouter.ai/api/v1";

const resolveBaseUrl = (env: Env): string => {
  const accountId = env.AI_GATEWAY_ACCOUNT_ID;
  if (!accountId || accountId.startsWith("PLACEHOLDER")) {
    return OPENROUTER_DIRECT_URL;
  }
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${env.AI_GATEWAY_NAME}/openrouter/v1`;
};

const getModel = (env: Env, modelId?: string) => {
  const id = modelId ?? env.CORRESPONDENT_MODEL;
  const connection = { apiKey: env.OPENROUTER_API_KEY, baseURL: resolveBaseUrl(env) };
  if (/^openai\/gpt-6(?:[.\-]|$)/v.test(id)) {
    // GPT-6 reasoning + tools requires Responses. OpenRouter is stateless:
    // replay tool results and encrypted reasoning instead of stored response IDs.
    return wrapLanguageModel({
      middleware: defaultSettingsMiddleware({
        settings: {
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              store: false,
              strictJsonSchema: false,
            },
          },
        },
      }),
      model: createOpenAI(connection).responses(id),
    });
  }
  const provider = createOpenAICompatible({
    ...connection,
    name: "openrouter",
  });
  return provider(id);
};

export { getModel };
