import { createModels } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { generateText, isStepCount, tool } from "ai";
import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  CONVERSATION_MODEL,
  conversationProvider,
  generateImage,
  IMAGE_MODEL,
  languageModel,
} from "#/lib/models";

afterEach(() => vi.unstubAllGlobals());

const GATEWAY_URL =
  "https://gateway.ai.cloudflare.com/v1/test-account-id/test-gateway/openrouter/v1";

const bodySchema = z.record(z.string(), z.unknown());

type CapturedRequest = {
  authorization: string | null;
  body: Record<string, unknown>;
  url: string;
};

const captureFetch = (respond: (requestCount: number) => Response) => {
  const requests: Array<CapturedRequest> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push({
        authorization: request.headers.get("authorization"),
        body: bodySchema.parse(await request.json()),
        url: request.url,
      });
      return respond(requests.length);
    }),
  );
  return requests;
};

const conversationModelId = CONVERSATION_MODEL.replace(/^openrouter\//v, "");

const conversationModels = () => {
  const models = createModels();
  models.setProvider(conversationProvider(env));
  return models;
};

const sse = (chunks: ReadonlyArray<object>) =>
  new Response(
    [...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`), "data: [DONE]\n\n"].join(""),
    { headers: { "content-type": "text/event-stream" } },
  );

describe("conversation provider (Flue)", () => {
  it("resolves the conversation model with image input and known context and cost", () => {
    expect(conversationModels().getModel("openrouter", conversationModelId)).toMatchObject({
      contextWindow: 1_000_000,
      cost: { input: 2, output: 10 },
      input: ["text", "image"],
      maxTokens: 128_000,
      reasoning: true,
    });
  });

  it("keeps the bundled OpenRouter models and never duplicates the conversation model", () => {
    const models = conversationProvider(env).getModels();
    expect(models.filter((model) => model.id === conversationModelId)).toHaveLength(1);
    for (const model of openrouterProvider().getModels()) {
      expect(models.some((candidate) => candidate.id === model.id)).toBe(true);
    }
  });

  it("streams through AI Gateway with the OpenRouter key and low reasoning", async () => {
    const requests = captureFetch(() =>
      sse([
        { choices: [{ delta: { content: "Oi", role: "assistant" }, index: 0 }], id: "gen-1" },
        {
          choices: [{ delta: {}, finish_reason: "stop", index: 0 }],
          id: "gen-1",
          usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
        },
      ]),
    );
    const models = conversationModels();
    const model = models.getModel("openrouter", conversationModelId);
    if (!model) {
      throw new Error("conversation model not registered");
    }
    const reply = await models.completeSimple(
      model,
      { messages: [{ content: "Olá", role: "user", timestamp: 0 }] },
      { reasoning: "low" },
    );
    expect(reply.content).toEqual([expect.objectContaining({ text: "Oi", type: "text" })]);
    expect(requests).toEqual([
      {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        body: expect.objectContaining({ model: conversationModelId, reasoning: { effort: "low" } }),
        url: `${GATEWAY_URL}/chat/completions`,
      },
    ]);
  });
});

describe("specialist language model (AI SDK)", () => {
  it.each(["openai/gpt-6-luna", "openai/gpt-6.1-sol"])(
    "%s replays reasoning and tool output through stateless Responses",
    async (model) => {
      const requests = captureFetch((count) =>
        Response.json({
          created_at: 1,
          id: `resp_${count}`,
          model,
          object: "response",
          output:
            count === 1
              ? [
                  {
                    encrypted_content: "encrypted-test",
                    id: "rs_1",
                    summary: [],
                    type: "reasoning",
                  },
                  {
                    arguments: '{"topic":"marca"}',
                    call_id: "call_1",
                    id: "fc_1",
                    name: "lookup",
                    status: "completed",
                    type: "function_call",
                  },
                ]
              : [
                  {
                    content: [{ annotations: [], text: "Feito.", type: "output_text" }],
                    id: "msg_1",
                    role: "assistant",
                    status: "completed",
                    type: "message",
                  },
                ],
          status: "completed",
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        }),
      );
      const lookup = vi.fn(({ topic }: { topic: string }) => `Contexto: ${topic}`);
      const inputSchema = z.object({ topic: z.string() });
      const result = await generateText({
        model: languageModel(env, model),
        prompt: "Consulte a marca.",
        stopWhen: isStepCount(3),
        tools: { lookup: tool({ execute: lookup, inputSchema }) },
      });
      expect(result.text).toBe("Feito.");
      expect(lookup).toHaveBeenCalledOnce();
      expect(requests).toHaveLength(2);
      for (const request of requests) {
        expect(request.url).toBe(`${GATEWAY_URL}/responses`);
        expect(request.authorization).toBe(`Bearer ${env.OPENROUTER_API_KEY}`);
        expect(request.body).toMatchObject({ model, reasoning: { effort: "low" }, store: false });
        expect(request.body.previous_response_id).toBeUndefined();
        expect(request.body.include).toContain("reasoning.encrypted_content");
        expect(request.body.temperature).toBeUndefined();
      }
      expect(requests[1]?.body.input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ call_id: "call_1", name: "lookup", type: "function_call" }),
          expect.objectContaining({
            call_id: "call_1",
            output: "Contexto: marca",
            type: "function_call_output",
          }),
          expect.objectContaining({ encrypted_content: "encrypted-test", type: "reasoning" }),
        ]),
      );
    },
  );

  it("sends other models to Chat Completions through AI Gateway", async () => {
    const requests = captureFetch(() =>
      Response.json({
        choices: [
          { finish_reason: "stop", index: 0, message: { content: "Feito.", role: "assistant" } },
        ],
        created: 1,
        id: "chat_1",
        model: "custom/model",
        usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
      }),
    );
    await generateText({ model: languageModel(env, "custom/model"), prompt: "Oi" });
    expect(requests).toEqual([
      {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        body: expect.objectContaining({ model: "custom/model" }),
        url: `${GATEWAY_URL}/chat/completions`,
      },
    ]);
  });
});

describe("image generation", () => {
  it("requests the image model through AI Gateway and returns the image URL", async () => {
    const requests = captureFetch(() =>
      Response.json({
        choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,AA==" } }] } }],
      }),
    );
    await expect(generateImage(env, "uma onça")).resolves.toBe("data:image/png;base64,AA==");
    expect(requests).toEqual([
      {
        authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        body: {
          messages: [{ content: "uma onça", role: "user" }],
          modalities: ["image", "text"],
          model: IMAGE_MODEL,
        },
        url: `${GATEWAY_URL}/chat/completions`,
      },
    ]);
  });
});
