import { createModels } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { describe, expect, it } from "vitest";

import { CONVERSATION_MODEL, conversationProvider } from "#/lib/flue-models";

describe("Flue conversational model catalog", () => {
  it("resolves the new Sonnet with image input and known context and cost", () => {
    const registry = createModels();
    registry.setProvider(conversationProvider);
    expect(registry.getModel("openrouter", CONVERSATION_MODEL)).toMatchObject({
      contextWindow: 1_000_000,
      input: ["text", "image"],
      maxTokens: 128_000,
      reasoning: true,
    });
    expect(registry.getModel("openrouter", CONVERSATION_MODEL)?.cost.input).toBeGreaterThan(0);
  });

  it("keeps existing OpenRouter models and never duplicates the new model", () => {
    const models = conversationProvider.getModels();
    expect(models.filter((model) => model.id === CONVERSATION_MODEL)).toHaveLength(1);
    for (const model of openrouterProvider().getModels()) {
      expect(models.some((candidate) => candidate.id === model.id)).toBe(true);
    }
  });
});
