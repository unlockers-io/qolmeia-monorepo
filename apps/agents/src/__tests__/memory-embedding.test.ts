import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EMBEDDING_DIMENSIONS, embeddingSchema } from "#/lib/memory/embedding";

describe("memory embedding contract", () => {
  it("accepts the same embedding shape used by runtime and backfill", () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25);
    expect(embeddingSchema.parse({ data: [vector] })).toEqual(vector);
  });

  it.each([
    undefined,
    { data: [] },
    { data: [[1, 2, 3]] },
    { data: [Array.from({ length: EMBEDDING_DIMENSIONS }, () => Number.NaN)] },
    { data: [Array.from({ length: EMBEDDING_DIMENSIONS }, () => "0.5")] },
  ])("rejects invalid vectors before writing or querying the index", (result) => {
    expect(() => embeddingSchema.parse(result)).toThrow(z.ZodError);
  });
});
