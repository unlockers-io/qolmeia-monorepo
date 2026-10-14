import type { ActivityEntry } from "@repo/worker-api/contracts";

import type { ActivityEvent } from "#/activity/types";
import type { Db } from "#/lib/db";
import { toRecordOrNull } from "#/lib/records";

type ActivityRecord = ActivityEvent & {
  actorId?: string | null;
  companyId: string;
  summary: string;
};

const recordActivity = async (db: Db, entry: ActivityRecord): Promise<void> => {
  await db.activityLog.create({
    data: {
      actorId: entry.actorId ?? null,
      companyId: entry.companyId,
      id: crypto.randomUUID(),
      payload: entry.payload,
      refId: entry.refId,
      refType: entry.refType,
      summary: entry.summary,
      type: entry.type,
    },
  });
};

const ACTIVITY_CATEGORIES = ["ACTION", "TICKET", "WORKER", "TEAM", "MEMBER"] as const;
type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

type ListActivityOptions = {
  before?: number;
  category?: ActivityCategory;
  companyId?: string;
  limit?: number;
  since?: number;
};

const listActivity = async (
  db: Db,
  options: ListActivityOptions = {},
): Promise<ReadonlyArray<ActivityEntry>> => {
  const rows = await db.activityLog.findMany({
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 100,
    where: {
      companyId: options.companyId,
      createdAt: {
        gte: options.since === undefined ? undefined : new Date(options.since),
        lt: options.before === undefined ? undefined : new Date(options.before),
      },
      type: options.category === undefined ? undefined : { startsWith: `${options.category}_` },
    },
  });
  return rows.map((row) => ({
    actorId: row.actorId,
    companyId: row.companyId,
    companyName: row.company.name,
    createdAt: row.createdAt.getTime(),
    id: row.id,
    payload: toRecordOrNull(row.payload),
    refId: row.refId,
    refType: row.refType,
    summary: row.summary,
    type: row.type,
  }));
};

export { ACTIVITY_CATEGORIES, listActivity, recordActivity };
export type { ActivityRecord };
