import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { Model, Provider } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";

type GatewayEnv = Pick<
  Env,
  "AI_GATEWAY_ACCOUNT_ID" | "AI_GATEWAY_NAME" | "OPENROUTER_API_KEY" | "WORKER_PUBLIC_URL"
>;

// Pi's bundled catalog predates this release; the metadata is copied from
// https://openrouter.ai/api/v1/models (2026-09-29).
const CONVERSATION: Omit<Model<"openai-completions">, "baseUrl"> = {
  api: "openai-completions",
  contextWindow: 1_000_000,
  cost: { cacheRead: 0.2, cacheWrite: 2.5, input: 2, output: 10 },
  id: "anthropic/claude-sonnet-5.5",
  input: ["text", "image"],
  maxTokens: 128_000,
  name: "Claude Sonnet 5.5",
  provider: "openrouter",
  reasoning: true,
};

const IMAGE_MODEL = "google/gemini-3.1-flash-image";

const RESPONSES_API_MODEL = /^openai\/gpt-6(?:[.\-]|$)/v;

const CONVERSATION_MODEL = `${CONVERSATION.provider}/${CONVERSATION.id}`;

const gateway = (env: GatewayEnv) => ({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/openrouter/v1`,
  headers: { "HTTP-Referer": env.WORKER_PUBLIC_URL, "X-Title": "Qolmeia" },
});

const conversationProvider = (env: GatewayEnv): Provider<"openai-completions"> => {
  const builtin = openrouterProvider();
  return {
    ...builtin,
    auth: {
      apiKey: {
        name: "OpenRouter through Cloudflare AI Gateway",
        resolve: () => {
          const { apiKey, baseURL, headers } = gateway(env);
          return Promise.resolve({ auth: { apiKey, baseUrl: baseURL, headers } });
        },
      },
    },
    getModels: () => [
      ...builtin.getModels().filter((model) => model.id !== CONVERSATION.id),
      { ...CONVERSATION, baseUrl: gateway(env).baseURL },
    ],
  };
};

const languageModel = (env: GatewayEnv, id: string) => {
  const connection = gateway(env);
  if (RESPONSES_API_MODEL.test(id)) {
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
  return createOpenAICompatible({ ...connection, name: "openrouter" })(id);
};

type ImagePromptPart =
  | { image_url: { url: string }; type: "image_url" }
  | { text: string; type: "text" };

type ChatCompletionResponse = {
  choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
};

const generateImage = async (
  env: GatewayEnv,
  prompt: string | ReadonlyArray<ImagePromptPart>,
): Promise<string> => {
  const { apiKey, baseURL, headers } = gateway(env);
  const response = await fetch(`${baseURL}/chat/completions`, {
    body: JSON.stringify({
      messages: [{ content: prompt, role: "user" }],
      modalities: ["image", "text"],
      model: IMAGE_MODEL,
    }),
    headers: { ...headers, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Image gen HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  const json = await response.json<ChatCompletionResponse>();
  const imageUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (imageUrl === undefined || imageUrl === "") {
    throw new Error("Image gen response missing choices[0].message.images[0].image_url.url");
  }
  return imageUrl;
};

export { CONVERSATION_MODEL, conversationProvider, generateImage, IMAGE_MODEL, languageModel };
export type { ImagePromptPart };
