import { describe, expect, it } from "vitest";

import { prisma } from "../client";
import { DEFAULT_TEMPLATES, seedProductDefaults } from "../product-seed";

describe.skipIf(process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === "")(
  "default model upgrades",
  () => {
    it("upgrades shipped models, preserves custom settings, and is idempotent", async () => {
      const rollback = new Error("rollback seed test");
      await expect(
        prisma.$transaction(async (db) => {
          await seedProductDefaults(db);
          await db.agentTemplate.update({
            data: { displayName: "Meu designer", model: "openai/gpt-5.4-nano" },
            where: { id: "tpl-designer" },
          });
          await db.agentTemplate.update({
            data: { model: "custom/writer" },
            where: { id: "tpl-redator" },
          });
          await db.agentTemplate.update({
            data: { model: "openai/gpt-5.4-mini" },
            where: { id: "tpl-seo-researcher" },
          });
          await seedProductDefaults(db);
          await seedProductDefaults(db);
          const designer = await db.agentTemplate.findUniqueOrThrow({
            where: { id: "tpl-designer" },
          });
          const writer = await db.agentTemplate.findUniqueOrThrow({ where: { id: "tpl-redator" } });
          const researcher = await db.agentTemplate.findUniqueOrThrow({
            where: { id: "tpl-seo-researcher" },
          });
          expect(designer).toMatchObject({
            displayName: "Meu designer",
            model: DEFAULT_TEMPLATES[0].model,
          });
          expect(writer.model).toBe("custom/writer");
          expect(researcher.model).toBe(DEFAULT_TEMPLATES[3].model);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
  },
);
