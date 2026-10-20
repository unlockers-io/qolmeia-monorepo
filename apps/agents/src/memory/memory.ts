import type { MemoryFact } from "@repo/db/worker";
import { log } from "@repo/observability";

import type { Db, PrismaClient } from "#/lib/db";
import { inMemoryIndex } from "#/memory/in-memory";
import { vectorizeIndex } from "#/memory/vectorize";
import type { VectorIndex, VectorQuery } from "#/memory/vectors";

type MemoryEnv = Pick<Env, "AI" | "MEMORY_BACKEND" | "VECTORIZE">;

type NewFact = Pick<MemoryFact, "agentInstanceId" | "content" | "kind">;

type RecalledFact = MemoryFact & { score: number };

const MIN_SCORE = 0.5;

let localIndex: VectorIndex | undefined;

const memoryIndex = (env: MemoryEnv): VectorIndex => {
  if (env.MEMORY_BACKEND === "in-memory") {
    localIndex ??= inMemoryIndex();
    return localIndex;
  }
  if (env.AI === undefined || env.VECTORIZE === undefined) {
    throw new Error(
      "Memory needs the AI and VECTORIZE bindings; MEMORY_BACKEND=in-memory is only for local dev and tests",
    );
  }
  return vectorizeIndex({ AI: env.AI, VECTORIZE: env.VECTORIZE });
};

const insertFacts = (
  db: Db,
  companyId: string,
  facts: ReadonlyArray<NewFact>,
): Promise<Array<MemoryFact>> =>
  db.memoryFact.createManyAndReturn({
    data: facts.map((fact) => ({ ...fact, companyId, id: crypto.randomUUID() })),
  });

const publishFacts = async (
  index: VectorIndex,
  db: PrismaClient,
  facts: ReadonlyArray<MemoryFact>,
): Promise<void> => {
  if (facts.length === 0) {
    return;
  }
  await index.upsert(facts);
  await db.memoryFact.updateMany({
    data: { indexedAt: new Date() },
    where: { id: { in: facts.map(({ id }) => id) } },
  });
};

const publishPendingFacts = async (env: MemoryEnv, db: PrismaClient): Promise<number> => {
  const facts = await db.memoryFact.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
    where: { indexedAt: null },
  });
  await publishFacts(memoryIndex(env), db, facts);
  return facts.length;
};

const remember = async (
  env: MemoryEnv,
  db: PrismaClient,
  companyId: string,
  facts: ReadonlyArray<NewFact>,
): Promise<ReadonlyArray<MemoryFact>> => {
  const index = memoryIndex(env);
  const rows = await insertFacts(db, companyId, facts);
  try {
    await publishFacts(index, db, rows);
  } catch (error) {
    log.error({
      companyId,
      error: error instanceof Error ? error.message : String(error),
      message: "memory.publication.pending",
    });
  }
  return rows;
};

const recall = async (
  env: MemoryEnv,
  db: Db,
  companyId: string,
  query: VectorQuery,
): Promise<ReadonlyArray<RecalledFact>> => {
  const matches = await memoryIndex(env).query(query);
  const relevant = matches.filter(({ score }) => score >= MIN_SCORE);
  const facts = await db.memoryFact.findMany({
    where: {
      agentInstanceId: query.agentInstanceId,
      companyId,
      id: { in: relevant.map(({ id }) => id) },
    },
  });
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  return relevant.flatMap(({ id, score }) => {
    const fact = byId.get(id);
    return fact === undefined ? [] : [{ ...fact, score }];
  });
};

export { insertFacts, publishPendingFacts, recall, remember };
export type { NewFact, RecalledFact };
