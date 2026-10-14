import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EMBEDDING_DIMENSIONS, embeddingsSchema } from "#/memory/vectors";

describe("memory embedding contract", () => {
  it("accepts the same embedding shape used by runtime and backfill", () => {
    const first = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);
    const second = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5);
    expect(embeddingsSchema.parse({ data: [first, second] })).toEqual([first, second]);
  });

  it.each([
    undefined,
    { data: [] },
    { data: [[1, 2, 3]] },
    { data: [Array.from({ length: EMBEDDING_DIMENSIONS }, () => Number.NaN)] },
    { data: [Array.from({ length: EMBEDDING_DIMENSIONS }, () => "0.5")] },
  ])("rejects invalid vectors before writing or querying the index", (result) => {
    expect(() => embeddingsSchema.parse(result)).toThrow(z.ZodError);
  });
});
