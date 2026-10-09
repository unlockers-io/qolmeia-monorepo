import type { AssetVisibility } from "@repo/db/worker";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { listAssets, persistAsset, readAssetText } from "#/library/assets";

const COMPANY_ID = "co_asset_store_test";

const persistText = (input: {
  name: string;
  text: string;
  visibility?: AssetVisibility;
}): Promise<{ assetId: string }> =>
  db((client) =>
    persistAsset(env, client, {
      bytes: new TextEncoder().encode(input.text),
      companyId: COMPANY_ID,
      kind: "knowledge_doc",
      metadata: { name: input.name },
      mime: "text/markdown",
      uploadMetadata: { generatedBy: "agent" },
      visibility: input.visibility ?? "customer",
    }),
  );

const list = (filter?: Parameters<typeof listAssets>[2]) =>
  db((client) => listAssets(client, COMPANY_ID, filter));

const read = (companyId: string, assetId: string) =>
  db((client) => readAssetText(env, client, companyId, assetId));

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
});

describe("library assets", () => {
  it("persists a text deliverable, lists it, and reads it back", async () => {
    const { assetId } = await persistText({
      name: "Plano semanal",
      text: "# Plano\n\nSegunda: post de lançamento.",
    });
    expect(assetId).toBeTruthy();

    const assets = await list({ kind: "knowledge_doc" });
    const found = assets.find((asset) => asset.id === assetId);
    expect(found?.kind).toBe("knowledge_doc");
    expect(found?.name).toBe("Plano semanal");

    const text = await read(COMPANY_ID, assetId);
    expect(text?.content).toContain("post de lançamento");
    expect(text?.name).toBe("Plano semanal");
  });

  it("dedups identical content on (company, sha256)", async () => {
    const first = await persistText({ name: "Nota", text: "conteúdo idêntico para dedup" });
    const second = await persistText({
      name: "Nota (de novo)",
      text: "conteúdo idêntico para dedup",
    });
    expect(second.assetId).toBe(first.assetId);
  });

  it("is tenant-scoped: another company cannot read the asset", async () => {
    const { assetId } = await persistText({
      name: "Privado",
      text: "segredo da empresa A que B não deve ler",
    });
    await expect(read("co_other_tenant", assetId)).resolves.toBeNull();
  });

  it("separates the customer folder from the agent folder (ADR 0007)", async () => {
    const customer = await persistText({
      name: "Entrega",
      text: "documento de entrega para o cliente",
    });
    const agentScratch = await persistText({
      name: "Recorte",
      text: "rascunho interno do agente",
      visibility: "agent",
    });

    const customerOnly = await list({ visibility: "customer" });
    expect(customerOnly.find((asset) => asset.id === customer.assetId)?.visibility).toBe(
      "customer",
    );
    expect(customerOnly.find((asset) => asset.id === agentScratch.assetId)).toBeUndefined();

    const agentOnly = await list({ visibility: "agent" });
    expect(agentOnly.find((asset) => asset.id === agentScratch.assetId)?.visibility).toBe("agent");
    expect(agentOnly.find((asset) => asset.id === customer.assetId)).toBeUndefined();

    const both = await list();
    expect(both.find((asset) => asset.id === customer.assetId)).toBeTruthy();
    expect(both.find((asset) => asset.id === agentScratch.assetId)).toBeTruthy();
  });
});
