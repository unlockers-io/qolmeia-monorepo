import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, entitle, seedCompany } from "#/__tests__/fixtures";
import cloudflare from "#/cloudflare";
import { publishPendingFacts, recall } from "#/memory/memory";
import { EMBEDDING_DIMENSIONS } from "#/memory/vectors";
import { confirmTeam } from "#/team/confirm";

const COMPANY_ID = "co_memory_publication";
const CORR_ID = `corr-${COMPANY_ID}`;
const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
const run = vi.fn();
const upsert = vi.fn();
const query = vi.fn();

const production = {
  ...env,
  AI: { run } as unknown as Ai,
  MEMORY_BACKEND: "vectorize",
  VECTORIZE: { query, upsert } as unknown as VectorizeIndex,
};

const confirm = () =>
  db((client) =>
    confirmTeam(production, client, {
      actorId: "customer",
      companyId: COMPANY_ID,
      templateIds: ["tpl-designer"],
    }),
  );

const facts = () => db((client) => client.memoryFact.findMany({ orderBy: { id: "asc" } }));
const publish = () => db((client) => publishPendingFacts(production, client));

beforeEach(async () => {
  vi.resetAllMocks();
  run.mockResolvedValue({ data: [vector, vector, vector] });
  upsert.mockResolvedValue({ mutationId: "accepted" });
  await seedCompany({
    brief: { audience: "Vizinhos", industry: "Padaria" },
    id: COMPANY_ID,
    status: "onboarding",
  });
  await entitle(COMPANY_ID);
});

afterEach(async () => {
  await db((client) =>
    client.$executeRawUnsafe("DROP TRIGGER IF EXISTS reject_memory_commit ON memory_fact"),
  );
});

describe("committed memory publication", () => {
  it("commits onboarding without contacting AI, and holds no transaction while embeddings are slow", async () => {
    const embedding = Promise.withResolvers<{ data: Array<Array<number>> }>();
    await confirm();
    expect(run).not.toHaveBeenCalled();
    const committed = await facts();
    expect(committed).toHaveLength(3);
    expect(committed.every((fact) => fact.indexedAt === null)).toBe(true);
    const started = Promise.withResolvers<undefined>();
    run.mockImplementationOnce(() => {
      started.resolve(undefined);

      return embedding.promise;
    });
    const publication = publish();
    await started.promise;
    expect(upsert).not.toHaveBeenCalled();
    await db((client) =>
      client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
        await tx.memoryFact.updateMany({
          data: { salience: 0.7 },
          where: { companyId: COMPANY_ID },
        });
        expect(await tx.team.count()).toBe(1);
        expect(await tx.activityLog.count()).toBe(1);
      }),
    );
    embedding.resolve({ data: [vector, vector, vector] });
    await expect(publication).resolves.toBe(3);
    expect(upsert.mock.calls[0]?.[0].map((fact: { id: string }) => fact.id).toSorted()).toEqual(
      committed.map(({ id }) => id),
    );
    const indexed = await facts();
    expect(indexed.every((fact) => fact.indexedAt instanceof Date)).toBe(true);
  });

  it("never publishes facts rolled back at transaction commit", async () => {
    await db(async (client) => {
      await client.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION reject_memory_commit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'memory commit failure'; END $$`);
      await client.$executeRawUnsafe(`CREATE CONSTRAINT TRIGGER reject_memory_commit AFTER INSERT ON memory_fact
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_memory_commit()`);
    });
    await expect(confirm()).rejects.toThrow("memory commit failure");
    expect(
      await db(async (client) => ({
        activity: await client.activityLog.count(),
        company: await client.company.findUnique({
          select: { status: true },
          where: { id: COMPANY_ID },
        }),
        facts: await client.memoryFact.count(),
        teams: await client.team.count(),
      })),
    ).toEqual({ activity: 0, company: { status: "onboarding" }, facts: 0, teams: 0 });
    await expect(publish()).resolves.toBe(0);
    expect(run).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each(["embedding", "publication"])(
    "retries a failed %s from committed IDs on the scheduled tick",
    async (failure) => {
      await confirm();
      const committed = await facts();

      if (failure === "embedding") {
        run.mockRejectedValueOnce(new Error("AI unavailable"));
      } else {
        upsert.mockRejectedValueOnce(new Error("Vectorize unavailable"));
      }

      await expect(publish()).rejects.toThrow("unavailable");
      expect(await facts()).toEqual(committed);
      await cloudflare.scheduled({ cron: "* * * * *" } as ScheduledController, production);
      const published = upsert.mock.calls.at(-1)?.[0] as Array<{ id: string }>;
      expect(published.map(({ id }) => id).toSorted()).toEqual(committed.map(({ id }) => id));
      query.mockResolvedValue({ matches: published.map(({ id }) => ({ id, score: 1 })) });

      const recalled = await db((client) =>
        recall(production, client, COMPANY_ID, {
          agentInstanceId: CORR_ID,
          text: "Padaria",
          topK: 4,
        }),
      );

      expect(recalled.map(({ id }) => id).toSorted()).toEqual(committed.map(({ id }) => id));
      expect(await facts()).toHaveLength(3);
      const calls = upsert.mock.calls.length;
      await expect(publish()).resolves.toBe(0);
      expect(upsert).toHaveBeenCalledTimes(calls);
    },
  );

  it("replays publication after Vectorize accepts but the database acknowledgement fails", async () => {
    await confirm();
    const committed = await facts();
    await db(async (client) => {
      await client.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION reject_memory_ack() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'acknowledgement failed'; END $$`);
      await client.$executeRawUnsafe(`CREATE TRIGGER reject_memory_ack BEFORE UPDATE OF indexed_at ON memory_fact
        FOR EACH ROW EXECUTE FUNCTION reject_memory_ack()`);
    });

    try {
      await expect(publish()).rejects.toThrow("acknowledgement failed");
      expect(await facts()).toEqual(committed);
    } finally {
      await db((client) =>
        client.$executeRawUnsafe("DROP TRIGGER reject_memory_ack ON memory_fact"),
      );
    }

    await expect(publish()).resolves.toBe(3);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1]).toEqual(upsert.mock.calls[0]);
    expect(await facts()).toHaveLength(3);
  });

  it("allows concurrent publishers to upsert the same IDs without duplicating facts", async () => {
    await confirm();
    const stored = await facts();
    await Promise.all([publish(), publish()]);
    expect(await facts()).toHaveLength(stored.length);

    for (const [batch] of upsert.mock.calls) {
      expect(batch.map(({ id }: { id: string }) => id).toSorted()).toEqual(
        stored.map(({ id }) => id),
      );
    }
  });
});
