import { prisma } from "@repo/db";
import { z } from "zod";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  MEMORY_INDEX,
  embeddingSchema,
} from "#/lib/memory/embedding";

const config = z
  .object({
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
    CLOUDFLARE_API_TOKEN: z.string().min(1),
  })
  .parse(process.env);
const base = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}`;
const indexPath = `/vectorize/v2/indexes/${MEMORY_INDEX}`;
const envelope = z.object({ result: z.unknown(), success: z.literal(true) });

const request = async <T>(schema: z.ZodType<T>, path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${config.CLOUDFLARE_API_TOKEN}`);
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    // Do not print request bodies (customer memory) or credentials.
    throw new Error(`Cloudflare ${path} failed with HTTP ${response.status}; rerun to resume`);
  }
  return schema.parse(envelope.parse(await response.json()).result);
};

const main = async (): Promise<void> => {
  const indexSchema = z.object({
    config: z.object({
      dimensions: z.literal(EMBEDDING_DIMENSIONS),
      metric: z.literal("cosine"),
    }),
    name: z.literal(MEMORY_INDEX),
  });
  const index = await request(indexSchema, indexPath);
  console.log(`Backfilling ${index.name} with ${EMBEDDING_MODEL}`);
  let cursor: string | undefined;
  let count = 0;
  while (true) {
    const facts = await prisma.memoryFact.findMany({
      cursor: cursor === undefined ? undefined : { id: cursor },
      orderBy: { id: "asc" },
      skip: cursor === undefined ? 0 : 1,
      take: 50,
    });
    if (facts.length === 0) {
      break;
    }
    // Bound provider load. Upserts keep source IDs, so reruns are idempotent.
    const vectors = [];
    for (const fact of facts) {
      const embedding = await request(embeddingSchema, `/ai/run/${EMBEDDING_MODEL}`, {
        body: JSON.stringify({ text: [fact.content] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      vectors.push({
        id: fact.id,
        metadata: {
          agentInstanceId: fact.agentInstanceId,
          companyId: fact.companyId,
          content: fact.content,
          createdAt: fact.createdAt.getTime(),
          kind: fact.kind,
        },
        values: embedding,
      });
    }
    const body = new FormData();
    body.set(
      "vectors",
      new Blob([vectors.map((vector) => JSON.stringify(vector)).join("\n")], {
        type: "application/x-ndjson",
      }),
      "vectors.ndjson",
    );
    const mutation = await request(z.object({ mutationId: z.string() }), `${indexPath}/upsert`, {
      body,
      method: "POST",
    });
    count += facts.length;
    cursor = facts.at(-1)?.id;
    console.log(`Queued ${count} facts; mutation ${mutation.mutationId}`);
  }
  console.log(`Queued ${count} facts. Wait for Vectorize indexing before deploying the Worker.`);
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
