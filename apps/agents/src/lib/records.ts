import { z } from "zod";

const recordSchema = z.record(z.string(), z.json());

type JsonRecord = z.infer<typeof recordSchema>;

const toRecordOrNull = (value: Parameters<typeof recordSchema.safeParse>[0]): JsonRecord | null =>
  recordSchema.safeParse(value).data ?? null;

export { toRecordOrNull };

export type { JsonRecord };
