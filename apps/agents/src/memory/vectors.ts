import { z } from "zod";

const EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b";
const EMBEDDING_DIMENSIONS = 1024;
const MEMORY_INDEX = "qolmeia-memory-qwen3";

const vectorSchema = z.array(z.number()).length(EMBEDDING_DIMENSIONS);
const embeddingsSchema = z
  .object({ data: z.tuple([vectorSchema]).rest(vectorSchema) })
  .transform(({ data }) => data);

type IndexedFact = { agentInstanceId: string; companyId: string; id: string };

type VectorMatch = { id: string; score: number };

type VectorQuery = { agentInstanceId: string; text: string; topK: number };

type VectorIndex = {
  query: (query: VectorQuery) => Promise<ReadonlyArray<VectorMatch>>;
  upsert: (facts: ReadonlyArray<IndexedFact & { content: string }>) => Promise<void>;
};

const toVector = (fact: IndexedFact, values: ReadonlyArray<number>) => ({
  id: fact.id,
  metadata: { agentInstanceId: fact.agentInstanceId, companyId: fact.companyId },
  values: [...values],
});

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, embeddingsSchema, MEMORY_INDEX, toVector };
export type { IndexedFact, VectorIndex, VectorMatch, VectorQuery };
