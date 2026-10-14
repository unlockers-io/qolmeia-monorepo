import type { AssetVisibility } from "@repo/db/worker";
import type { OrgRole } from "@repo/worker-api/contracts";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import {
  deleteAssets,
  listAssets,
  openAsset,
  promoteAssets,
  readAssetText,
  storeAsset,
} from "#/library/assets";

const COMPANY_ID = "co_asset_store_test";
const OTHER_COMPANY_ID = "co_other_tenant";

const store = (text: string, visibility: AssetVisibility = "customer") =>
  db((client) =>
    storeAsset(env, client, {
      bytes: new TextEncoder().encode(text),
      companyId: COMPANY_ID,
      kind: "knowledge_doc",
      metadata: { name: text },
      mime: "text/markdown",
      visibility,
    }),
  );

const list = (filter?: Parameters<typeof listAssets>[2]) =>
  db((client) => listAssets(client, COMPANY_ID, filter));

const read = (companyId: string, assetId: string) =>
  db((client) => readAssetText(env, client, companyId, assetId));

const open = async (assetId: string, role: OrgRole, companyId: string) => {
  const asset = await db((client) => openAsset(env, client, assetId, { companyId, role }));
  return asset === null ? null : new Response(asset.body).text();
};

const storedKeys = async () => {
  const listed = await env.ASSETS.list({ prefix: `org_${COMPANY_ID}/` });
  return listed.objects.map(({ key }) => key);
};

const rows = () =>
  db((client) =>
    client.asset.findMany({
      select: { r2Key: true, visibility: true },
      where: { companyId: COMPANY_ID },
    }),
  );

const failAssetInserts = () =>
  db(async (client) => {
    await client.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION reject_insert() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN RAISE EXCEPTION 'injected failure'; END $$`,
    );
    await client.$executeRawUnsafe(
      `CREATE TRIGGER reject_insert BEFORE INSERT ON asset FOR EACH ROW EXECUTE FUNCTION reject_insert()`,
    );
  });

beforeEach(async () => {
  await env.ASSETS.delete(await storedKeys());
  await seedCompany({ id: COMPANY_ID });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db((client) => client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS reject_insert ON asset`));
});

describe("library assets", () => {
  it("stores a text deliverable, lists it, and reads it back", async () => {
    const { assetId } = await store("# Plano\n\nSegunda: post de lançamento.");

    const assets = await list({ kind: "knowledge_doc" });
    expect(assets.find((asset) => asset.id === assetId)?.kind).toBe("knowledge_doc");

    const text = await read(COMPANY_ID, assetId);
    expect(text?.content).toContain("post de lançamento");
  });

  it("dedups identical content on (company, sha256)", async () => {
    const first = await store("conteúdo idêntico para dedup");
    const second = await store("conteúdo idêntico para dedup");
    expect(second.assetId).toBe(first.assetId);
    await expect(storedKeys()).resolves.toHaveLength(1);
  });

  it("is tenant-scoped: another company cannot read the asset", async () => {
    const { assetId } = await store("segredo da empresa A que B não deve ler");
    await expect(read(OTHER_COMPANY_ID, assetId)).resolves.toBeNull();
  });

  it("separates the customer folder from the agent folder (ADR 0007)", async () => {
    const customer = await store("documento de entrega para o cliente");
    const agentScratch = await store("rascunho interno do agente", "agent");

    const customerOnly = await list({ visibility: "customer" });
    expect(customerOnly.map(({ id }) => id)).toEqual([customer.assetId]);

    const agentOnly = await list({ visibility: "agent" });
    expect(agentOnly.map(({ id }) => id)).toEqual([agentScratch.assetId]);
  });
});

describe("library consistency", () => {
  it("stores the object and its row together", async () => {
    await store("entrega");

    const [row] = await rows();
    await expect(storedKeys()).resolves.toEqual([row?.r2Key]);
  });

  it("leaves no row when R2 rejects the upload", async () => {
    vi.spyOn(env.ASSETS, "put").mockRejectedValueOnce(new Error("r2 unavailable"));

    await expect(store("entrega")).rejects.toThrow("r2 unavailable");
    await expect(rows()).resolves.toEqual([]);
  });

  it("removes the uploaded object when its row cannot be written", async () => {
    await failAssetInserts();

    await expect(store("entrega")).rejects.toThrow(/injected failure/v);
    await expect(storedKeys()).resolves.toEqual([]);
  });

  it("promotes to the customer folder without moving the object", async () => {
    const { assetId } = await store("rascunho aprovado", "agent");
    const [before] = await rows();

    await expect(db((client) => promoteAssets(client, COMPANY_ID, [assetId]))).resolves.toEqual([
      { id: assetId, mime: "text/markdown" },
    ]);

    await expect(rows()).resolves.toEqual([{ r2Key: before?.r2Key, visibility: "customer" }]);
    await expect(storedKeys()).resolves.toEqual([before?.r2Key]);
    await expect(open(assetId, "CUSTOMER", COMPANY_ID)).resolves.toBe("rascunho aprovado");
  });

  it("promotes agent material that is stored again for the customer", async () => {
    const draft = await store("mesmo conteúdo", "agent");
    const delivered = await store("mesmo conteúdo", "customer");

    expect(delivered.assetId).toBe(draft.assetId);
    await expect(list({ visibility: "customer" })).resolves.toHaveLength(1);
  });

  it("deletes the object and its row together", async () => {
    const { assetId } = await store("descartável");

    await expect(
      db((client) => deleteAssets(env, client, COMPANY_ID, { ids: [assetId] })),
    ).resolves.toBe(1);

    await expect(rows()).resolves.toEqual([]);
    await expect(storedKeys()).resolves.toEqual([]);
  });

  it("keeps the asset whole when R2 rejects the delete", async () => {
    const { assetId } = await store("permanece");
    vi.spyOn(env.ASSETS, "delete").mockRejectedValueOnce(new Error("r2 unavailable"));

    await expect(
      db((client) => deleteAssets(env, client, COMPANY_ID, { ids: [assetId] })),
    ).rejects.toThrow("r2 unavailable");

    await expect(rows()).resolves.toHaveLength(1);
    await expect(open(assetId, "CUSTOMER", COMPANY_ID)).resolves.toBe("permanece");
  });
});

describe("library authorization", () => {
  it("gives a Customer their own Company's customer folder only", async () => {
    const delivered = await store("entrega do cliente");
    const scratch = await store("material do agente", "agent");

    await expect(open(delivered.assetId, "CUSTOMER", COMPANY_ID)).resolves.toBe(
      "entrega do cliente",
    );
    await expect(open(scratch.assetId, "CUSTOMER", COMPANY_ID)).resolves.toBeNull();
    await expect(open(delivered.assetId, "CUSTOMER", OTHER_COMPANY_ID)).resolves.toBeNull();
  });

  it.each(["OWNER", "STAFF"] as const)(
    "gives an %s Operator both folders of any Company",
    async (role) => {
      const delivered = await store("entrega do cliente");
      const scratch = await store("material do agente", "agent");

      await expect(open(delivered.assetId, role, "co_qolmeia")).resolves.toBe("entrega do cliente");
      await expect(open(scratch.assetId, role, "co_qolmeia")).resolves.toBe("material do agente");
    },
  );
});
