import { describe, expect, it } from "vitest";

import { prisma } from "../client";
import { seedProductDefaults } from "../product-seed";

describe.skipIf(process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === "")(
  "product defaults",
  () => {
    it("preserves operator edits to shipped templates and is idempotent", async () => {
      const rollback = new Error("rollback seed test");
      await expect(
        prisma.$transaction(async (db) => {
          await seedProductDefaults(db);
          await db.agentTemplate.update({
            data: { displayName: "Meu designer", model: "custom/designer" },
            where: { id: "tpl-designer" },
          });
          await seedProductDefaults(db);
          await seedProductDefaults(db);

          const designer = await db.agentTemplate.findUniqueOrThrow({
            where: { id: "tpl-designer" },
          });

          expect(designer).toMatchObject({ displayName: "Meu designer", model: "custom/designer" });
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
  },
);
