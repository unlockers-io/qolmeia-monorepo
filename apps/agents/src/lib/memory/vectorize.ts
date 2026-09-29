import type { MemoryAdapter, MemoryRecord, RetrieveArgs, ScoredRecord } from "#/lib/memory/adapter";
import { EMBEDDING_MODEL, embeddingSchema } from "#/lib/memory/embedding";

type Bindings = { AI: Ai; VECTORIZE: VectorizeIndex };

const metaString = (value: VectorizeVectorMetadata | undefined): string =>
  typeof value === "string" ? value : "";

class VectorizeMemoryAdapter implements MemoryAdapter {
  constructor(private readonly env: Bindings) {}

  async retrieve(args: RetrieveArgs): Promise<ReadonlyArray<ScoredRecord>> {
    const vector = await this.embed(args.query);
    const result = await this.env.VECTORIZE.query(vector, {
      filter: { agentInstanceId: args.agentInstanceId },
      returnMetadata: "all",
      topK: args.topK,
    });
    const min = args.minScore ?? 0.5;
    const records: Array<ScoredRecord> = [];
    for (const match of result.matches) {
      if (match.score < min) {
        continue;
      }
      const m: Partial<Record<string, VectorizeVectorMetadata>> = match.metadata ?? {};
      records.push({
        agentInstanceId: metaString(m.agentInstanceId),
        companyId: metaString(m.companyId),
        content: metaString(m.content),
        createdAt: Number(m.createdAt ?? 0),
        id: match.id,
        kind: metaString(m.kind),
        score: match.score,
      });
    }
    return records;
  }

  async upsert(record: MemoryRecord): Promise<void> {
    const values = await this.embed(record.content);
    await this.env.VECTORIZE.upsert([
      {
        id: record.id,
        metadata: {
          agentInstanceId: record.agentInstanceId,
          companyId: record.companyId,
          content: record.content,
          createdAt: record.createdAt,
          kind: record.kind,
        },
        values,
      },
    ]);
  }

  private async embed(text: string): Promise<Array<number>> {
    const result: unknown = await this.env.AI.run(EMBEDDING_MODEL, { text: [text] });
    return embeddingSchema.parse(result);
  }
}

export { VectorizeMemoryAdapter };
