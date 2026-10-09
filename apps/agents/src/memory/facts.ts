import type { Db } from "#/lib/db";
import { getMemoryAdapter } from "#/lib/memory";
import type { MemoryRecord } from "#/lib/memory/adapter";

type NewMemoryFact = Pick<MemoryRecord, "agentInstanceId" | "companyId" | "content" | "kind">;

const recordMemoryFacts = async (
  db: Db,
  facts: ReadonlyArray<NewMemoryFact>,
): Promise<ReadonlyArray<MemoryRecord>> => {
  const rows = await db.memoryFact.createManyAndReturn({
    data: facts.map((fact) => ({
      agentInstanceId: fact.agentInstanceId,
      companyId: fact.companyId,
      content: fact.content,
      id: crypto.randomUUID(),
      kind: fact.kind,
    })),
  });
  return rows.map((row) => ({
    agentInstanceId: row.agentInstanceId,
    companyId: row.companyId,
    content: row.content,
    createdAt: row.createdAt.getTime(),
    id: row.id,
    kind: row.kind,
  }));
};

const indexMemoryFacts = async (env: Env, records: ReadonlyArray<MemoryRecord>): Promise<void> => {
  const memory = getMemoryAdapter(env);
  await Promise.all(records.map((record) => memory.upsert(record)));
};

export { indexMemoryFacts, recordMemoryFacts };
export type { NewMemoryFact };
