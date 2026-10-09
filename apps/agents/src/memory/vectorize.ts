import { EMBEDDING_MODEL, embeddingsSchema, toVector, type VectorIndex } from "#/memory/vectors";

type Bindings = { AI: Ai; VECTORIZE: VectorizeIndex };

const vectorizeIndex = ({ AI, VECTORIZE }: Bindings): VectorIndex => {
  const embed = async (texts: ReadonlyArray<string>) =>
    embeddingsSchema.parse(await AI.run(EMBEDDING_MODEL, { text: [...texts] }));

  return {
    async query({ agentInstanceId, text, topK }) {
      const [vector] = await embed([text]);
      const { matches } = await VECTORIZE.query(vector, { filter: { agentInstanceId }, topK });
      return matches.map(({ id, score }) => ({ id, score }));
    },
    async upsert(facts) {
      const vectors = await embed(facts.map(({ content }) => content));
      await VECTORIZE.upsert(
        facts.map((fact, index) => {
          const values = vectors[index];
          if (values === undefined) {
            throw new Error(`no embedding returned for memory fact ${fact.id}`);
          }
          return toVector(fact, values);
        }),
      );
    },
  };
};

export { vectorizeIndex };
