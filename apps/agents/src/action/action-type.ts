import type { Prisma } from "@repo/db/worker";
import type { ActionPolicy, ActionType, ProposedOf } from "@repo/worker-api/contracts";
import { z } from "zod";

import type { Db } from "#/lib/db";

/** What a skill that stores an asset returns; the job's deliverable is every output marked `deliverable`. */
const assetOutputSchema = z.object({
  assetId: z.string(),
  deliverable: z.boolean(),
  url: z.string().optional(),
});

type AssetOutput = z.infer<typeof assetOutputSchema>;

// step.do results must be non-recursive (TS2589), so tool outputs cross as JSON text.
type ToolOutput = { json: string; tool: string };

type Generation = { outputs: ReadonlyArray<ToolOutput>; summary: string };

type ExecutionContext = { companyId: string; db: Db };

/** `read` parses a stored payload with the type's contract schema; `execute` runs on it. */
type ActionTypeModule<Type extends ActionType> = {
  defaultPolicy: ActionPolicy;
  execute: (ctx: ExecutionContext, proposed: Prisma.JsonValue) => Promise<string>;
  propose: (generation: Generation) => ProposedOf<Type>;
  read: (proposed: Prisma.JsonValue) => ProposedOf<Type>;
};

export { assetOutputSchema };

export type { ActionTypeModule, AssetOutput, ExecutionContext, Generation };
