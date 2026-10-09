import { z } from "zod";

const jsonSchema = z.json();
const recordSchema = z.record(z.string(), jsonSchema);
type JsonValue = z.infer<typeof jsonSchema>;
type JsonRecord = z.infer<typeof recordSchema>;
type RecordInput = Parameters<typeof recordSchema.safeParse>[0];

const toRecord = (value: RecordInput): JsonRecord => {
  const parsed = recordSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
};

const toRecordOrNull = (value: RecordInput): JsonRecord | null => {
  const parsed = recordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export { toRecord, toRecordOrNull };
export type { JsonRecord, JsonValue };
