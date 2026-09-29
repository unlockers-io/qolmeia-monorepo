import { z } from "zod";

const EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b";
const EMBEDDING_DIMENSIONS = 1024;
const MEMORY_INDEX = "qolmeia-memory-qwen3";

const vectorSchema = z.array(z.number()).length(EMBEDDING_DIMENSIONS);
const dataSchema = z.tuple([vectorSchema]).rest(vectorSchema);
const embeddingSchema = z.object({ data: dataSchema }).transform(({ data: [vector] }) => vector);

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, MEMORY_INDEX, embeddingSchema };
