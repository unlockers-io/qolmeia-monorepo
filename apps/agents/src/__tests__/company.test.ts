import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { getCompany, updateBrief } from "#/company/company";

const COMPANY_ID = "test-co";

beforeEach(async () => {
  await seedCompany({ brief: { industry: "Padaria" }, id: COMPANY_ID });
});

describe("getCompany", () => {
  it("returns a seeded company with its parsed brief", async () => {
    const company = await db((client) => getCompany(client, COMPANY_ID));
    expect(company).toMatchObject({
      brief: { industry: "Padaria" },
      id: COMPANY_ID,
      slug: COMPANY_ID,
      status: "active",
    });
  });

  it("refuses an unknown id with 404", async () => {
    await expect(db((client) => getCompany(client, "missing"))).rejects.toMatchObject({
      message: "company not found",
      status: 404,
    });
  });
});

describe("updateBrief", () => {
  it("keeps every field written by concurrent updates", async () => {
    await Promise.all([
      db((client) => updateBrief(client, COMPANY_ID, { audience: "Vizinhos" })),
      db((client) => updateBrief(client, COMPANY_ID, { primaryGoal: "Vender mais pão" })),
      db((client) => updateBrief(client, COMPANY_ID, { brand: { voice: "Caloroso" } })),
    ]);
    const company = await db((client) => getCompany(client, COMPANY_ID));
    expect(company.brief).toMatchObject({
      audience: "Vizinhos",
      brand: { voice: "Caloroso" },
      industry: "Padaria",
      primaryGoal: "Vender mais pão",
    });
  });

  it("refuses an unknown company with 404", async () => {
    await expect(
      db((client) => updateBrief(client, "missing", { audience: "x" })),
    ).rejects.toMatchObject({ message: "company not found", status: 404 });
  });
});
