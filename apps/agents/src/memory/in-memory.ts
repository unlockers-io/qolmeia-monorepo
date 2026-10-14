import type { VectorIndex } from "#/memory/vectors";

const DIM = 256;

const FNV_OFFSET = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;

const hash = (input: string): number => {
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    h ^= input.codePointAt(i) ?? 0;
    h = Math.imul(h, FNV_PRIME);
  }
  return h;
};

const embed = (text: string): Array<number> => {
  const normalized = text.toLowerCase().replaceAll(/\s+/gv, " ").trim();
  const vec = Array.from({ length: DIM }, () => 0);
  if (normalized.length < 3) {
    const idx = Math.abs(hash(normalized)) % DIM;
    vec[idx] = (vec[idx] ?? 0) + 1;
  } else {
    for (let i = 0; i <= normalized.length - 3; i++) {
      const trigram = normalized.slice(i, i + 3);
      const idx = Math.abs(hash(trigram)) % DIM;
      vec[idx] = (vec[idx] ?? 0) + 1;
    }
  }
  let norm = 0;
  for (const v of vec) {
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < DIM; i++) {
      vec[i] = (vec[i] ?? 0) / norm;
    }
  }
  return vec;
};

const dot = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
};

const inMemoryIndex = (): VectorIndex => {
  const buckets = new Map<string, Map<string, ReadonlyArray<number>>>();
  return {
    query: ({ agentInstanceId, text, topK }) => {
      const queryEmbedding = embed(text);
      const matches = [...(buckets.get(agentInstanceId) ?? [])].map(([id, embedding]) => ({
        id,
        score: dot(queryEmbedding, embedding),
      }));
      matches.sort((a, b) => b.score - a.score);
      return Promise.resolve(matches.slice(0, topK));
    },
    upsert: (facts) => {
      for (const fact of facts) {
        const bucket =
          buckets.get(fact.agentInstanceId) ?? new Map<string, ReadonlyArray<number>>();
        bucket.set(fact.id, embed(fact.content));
        buckets.set(fact.agentInstanceId, bucket);
      }
      return Promise.resolve();
    },
  };
};

export { inMemoryIndex };
