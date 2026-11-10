import { describe, expect, it } from "vitest";

import { briefCompleteness, briefPatchSchema, mergeBrief, parseBrief } from "./brief";

describe("briefPatchSchema", () => {
  it("validates a complete brief", () => {
    const ok = briefPatchSchema.safeParse({
      audience: "donos de cafeteria em SP",
      brand: { palette: "marrom + creme", voice: "acolhedora" },
      channels: ["instagram", "whatsapp"],
      industry: "alimentação",
      locale: "pt-BR",
      primaryGoal: "aumentar vendas no fim de semana",
      schemaVersion: 1,
    });

    expect(ok.success).toBe(true);
  });

  it("accepts an empty brief during the debrief", () => {
    const ok = briefPatchSchema.safeParse({});
    expect(ok.success).toBe(true);
  });

  it("rejects an invalid channel", () => {
    const result = briefPatchSchema.safeParse({
      channels: ["not-a-real-channel"],
    });

    expect(result.success).toBe(false);
  });
});

describe("mergeBrief", () => {
  it("partial updates land on top of existing fields without overwriting with undefined", () => {
    const existing = { audience: "vegetariano", industry: "alimentação" };
    const updates = { industry: "alimentação saudável", primaryGoal: "delivery" };
    const merged = mergeBrief(existing, updates);
    expect(merged.audience).toBe("vegetariano");
    expect(merged.industry).toBe("alimentação saudável");
    expect(merged.primaryGoal).toBe("delivery");
  });

  it("fills in default locale and schemaVersion when neither side specifies", () => {
    const merged = mergeBrief({}, {});
    expect(merged.locale).toBe("pt-BR");
    expect(merged.schemaVersion).toBe(1);
  });
});

describe("parseBrief", () => {
  it("returns {} for a missing brief", () => {
    expect(parseBrief(null)).toEqual({});
  });

  it("returns {} for a brief that does not match the schema", () => {
    expect(parseBrief({ channels: ["not-a-channel"] })).toEqual({});
  });

  it("parses a stored brief", () => {
    const parsed = parseBrief({ industry: "SaaS", primaryGoal: "leads" });
    expect(parsed.industry).toBe("SaaS");
    expect(parsed.primaryGoal).toBe("leads");
  });
});

describe("briefCompleteness", () => {
  it("reports 0% and all 6 fields missing for an empty brief", () => {
    const c = briefCompleteness({});
    expect(c.percent).toBe(0);
    expect(c.isComplete).toBe(false);
    expect(c.missing).toHaveLength(6);
    expect(c.filled).toHaveLength(0);
  });

  it("counts each filled required field, including nested brand fields", () => {
    const c = briefCompleteness({
      brand: { voice: "acolhedora" },
      industry: "alimentação",
    });

    expect(c.filled).toEqual(expect.arrayContaining(["industry", "brand.voice"]));
    expect(c.filled).toHaveLength(2);
    expect(c.percent).toBe(33);
    expect(c.isComplete).toBe(false);
  });

  it("does not count channels — they're no longer part of the brief", () => {
    const c = briefCompleteness({ channels: ["instagram"] });
    expect(c.filled).toHaveLength(0);
    expect(c.missing).not.toContain("channels");
  });

  it("is complete only when all 6 fields are present", () => {
    const c = briefCompleteness({
      audience: "donos de cafeteria",
      brand: { palette: "marrom", references: "Starbucks", voice: "acolhedora" },
      industry: "alimentação",
      primaryGoal: "vender mais",
    });

    expect(c.isComplete).toBe(true);
    expect(c.percent).toBe(100);
    expect(c.missing).toHaveLength(0);
  });
});
