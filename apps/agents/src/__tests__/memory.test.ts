import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany, seedTeam } from "#/__tests__/fixtures";
import { recall, remember } from "#/memory/memory";
import { EMBEDDING_DIMENSIONS } from "#/memory/vectors";

const COMPANY_ID = "co_memory";
const OTHER_COMPANY_ID = "co_memory_other";
const WORKER_ID = "agent-memory-designer";

let correspondentId: string;

const rememberFor = (agentInstanceId: string, content: string, companyId = COMPANY_ID) =>
  db((client) => remember(env, client, companyId, [{ agentInstanceId, content, kind: "fact" }]));

const recallFor = (agentInstanceId: string, text: string, companyId = COMPANY_ID) =>
  db((client) => recall(env, client, companyId, { agentInstanceId, text, topK: 4 }));

const factCount = () => db((client) => client.memoryFact.count());

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
  await seedCompany({ id: OTHER_COMPANY_ID });
  ({ correspondentId } = await seedTeam(COMPANY_ID, [{ id: WORKER_ID }]));
});

describe("Memory", () => {
  it("recalls what an agent remembered, most relevant first", async () => {
    await rememberFor(correspondentId, "A cor preferida da marca é azul marinho");
    await rememberFor(correspondentId, "O público são vizinhos do bairro");

    const recalled = await recallFor(correspondentId, "cor preferida da marca");

    expect(recalled[0]).toMatchObject({
      agentInstanceId: correspondentId,
      companyId: COMPANY_ID,
      content: "A cor preferida da marca é azul marinho",
    });
    expect(recalled.every(({ score }) => score >= 0.5)).toBe(true);
  });

  it("keeps each agent's and each Company's memory apart", async () => {
    await rememberFor(correspondentId, "A cor preferida da marca é verde musgo");

    await expect(recallFor(WORKER_ID, "cor preferida da marca")).resolves.toEqual([]);
    await expect(
      recallFor(correspondentId, "cor preferida da marca", OTHER_COMPANY_ID),
    ).resolves.toEqual([]);
  });

  it("fails loudly without the Vectorize binding outside local dev and tests", async () => {
    const production = { AI: undefined, MEMORY_BACKEND: "vectorize", VECTORIZE: undefined };

    await expect(
      db((client) =>
        remember(production, client, COMPANY_ID, [
          { agentInstanceId: correspondentId, content: "fato", kind: "fact" },
        ]),
      ),
    ).rejects.toThrow(/VECTORIZE/v);
    await expect(
      db((client) =>
        recall(production, client, COMPANY_ID, {
          agentInstanceId: correspondentId,
          text: "fato",
          topK: 4,
        }),
      ),
    ).rejects.toThrow(/VECTORIZE/v);
    await expect(factCount()).resolves.toBe(0);
  });

  it("writes no fact when the vector index rejects it", async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    const unavailable = {
      AI: { run: () => Promise.resolve({ data: [vector] }) } as unknown as Ai,
      MEMORY_BACKEND: "vectorize",
      VECTORIZE: {
        upsert: () => Promise.reject(new Error("vectorize unavailable")),
      } as unknown as VectorizeIndex,
    };

    await expect(
      db((client) =>
        remember(unavailable, client, COMPANY_ID, [
          { agentInstanceId: correspondentId, content: "fato", kind: "fact" },
        ]),
      ),
    ).rejects.toThrow("vectorize unavailable");
    await expect(factCount()).resolves.toBe(0);
  });
});
