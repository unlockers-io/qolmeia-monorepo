import type { ActivityCategory, ActivityEntry } from "@repo/worker-api/contracts";

import type { ActivityEvent } from "#/activity/types";
import type { Db } from "#/lib/db";
import { toRecordOrNull } from "#/lib/records";

type ActivityRecord = ActivityEvent & {
  actorId?: string;
  companyId: string;
  summary: string;
};

const recordActivity = async (db: Db, entry: ActivityRecord): Promise<void> => {
  await db.activityLog.create({
    data: {
      actorId: entry.actorId,
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

type ListActivityOptions = {
  before?: number;
  category?: ActivityCategory;
  companyId?: string;
  limit?: number;
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
      createdAt: options.before === undefined ? undefined : { lt: new Date(options.before) },
      type: options.category === undefined ? undefined : { startsWith: `${options.category}_` },
    },
  });

  return rows.map((row) => ({
    companyId: row.companyId,
    companyName: row.company.name,
    createdAt: row.createdAt.getTime(),
    id: row.id,
    payload: toRecordOrNull(row.payload),
    summary: row.summary,
    type: row.type,
  }));
};

export { listActivity, recordActivity };

export type { ActivityRecord };
