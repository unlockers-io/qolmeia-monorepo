import type { ActionPolicy } from "@repo/worker-api/contracts";

import type { JsonRecord } from "#/lib/records";

// step.do results must be non-recursive (TS2589), so tool outputs cross as JSON text.
type ToolOutput = { json: string; tool: string };

type Generation = { outputs: ReadonlyArray<ToolOutput>; summary: string };

type ExecutionContext = { companyId: string; env: Env };

type ActionTypeModule = {
  defaultPolicy: ActionPolicy;
  execute: (ctx: ExecutionContext, proposed: JsonRecord) => Promise<string>;
  propose: (generation: Generation) => JsonRecord;
};

export type { ActionTypeModule, ExecutionContext, Generation, ToolOutput };
