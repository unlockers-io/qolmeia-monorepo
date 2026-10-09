import type { MemoryFact } from "@repo/db/worker";

import type { Db } from "#/lib/db";
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

const remember = async (
  env: MemoryEnv,
  db: Db,
  companyId: string,
  facts: ReadonlyArray<NewFact>,
): Promise<ReadonlyArray<MemoryFact>> => {
  const index = memoryIndex(env);
  const rows = await db.memoryFact.createManyAndReturn({
    data: facts.map((fact) => ({
      agentInstanceId: fact.agentInstanceId,
      companyId,
      content: fact.content,
      id: crypto.randomUUID(),
      kind: fact.kind,
    })),
  });
  try {
    await index.upsert(rows);
  } catch (error) {
    await db.memoryFact.deleteMany({ where: { id: { in: rows.map(({ id }) => id) } } });
    throw error;
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

export { recall, remember };
export type { NewFact, RecalledFact };
