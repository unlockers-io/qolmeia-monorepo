import { generateText, isStepCount, tool } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getModel } from "#/lib/ai-gateway";

afterEach(() => vi.unstubAllGlobals());

const env = {
  AI_GATEWAY_ACCOUNT_ID: "account",
  AI_GATEWAY_NAME: "gateway",
  CORRESPONDENT_MODEL: "anthropic/claude-sonnet-5.5",
  OPENROUTER_API_KEY: "test-key",
} as Env;

describe("specialist model transport", () => {
  it.each(["openai/gpt-6-luna", "openai/gpt-6.1-sol"])(
    "%s replays reasoning and tool output through stateless Responses",
    async (model) => {
      const requests: Array<{ body: Record<string, unknown>; url: string }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string, init: RequestInit) => {
          const body = z
            .record(z.string(), z.unknown())
            .parse(JSON.parse(z.string().parse(init.body)));
          requests.push({ body, url });
          return Promise.resolve(
            Response.json({
              created_at: 1,
              id: `resp_${requests.length}`,
              model,
              object: "response",
              output:
                requests.length === 1
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
        }),
      );
      const lookup = vi.fn(({ topic }: { topic: string }) => `Contexto: ${topic}`);
      const inputSchema = z.object({ topic: z.string() });
      const result = await generateText({
        model: getModel(env, model),
        prompt: "Consulte a marca.",
        stopWhen: isStepCount(3),
        tools: { lookup: tool({ execute: lookup, inputSchema }) },
      });
      expect(result.text).toBe("Feito.");
      expect(lookup).toHaveBeenCalledOnce();
      expect(requests).toHaveLength(2);
      for (const request of requests) {
        expect(request.url).toBe(
          "https://gateway.ai.cloudflare.com/v1/account/gateway/openrouter/v1/responses",
        );
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

  it("retains Chat Completions for custom models and direct access without a gateway", async () => {
    const fetch = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(
        Response.json({
          choices: [
            { finish_reason: "stop", index: 0, message: { content: "Feito.", role: "assistant" } },
          ],
          created: 1,
          id: "chat_1",
          model: "custom/model",
          usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await generateText({
      model: getModel({ ...env, AI_GATEWAY_ACCOUNT_ID: "" }, "custom/model"),
      prompt: "Oi",
    });
    expect(fetch.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  });
});
