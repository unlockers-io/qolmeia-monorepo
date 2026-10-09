import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { listActivity, recordActivity, type ActivityRecord } from "#/activity/log";

const COMPANY_ID = "co_activity_test";
const ACTIVITY_FOREIGN_KEY = /activity_log_company_id_fkey|Foreign key constraint/v;

const record = (entry: ActivityRecord) => db((client) => recordActivity(client, entry));

const list = (since?: number) =>
  db((client) => listActivity(client, { companyId: COMPANY_ID, since }));

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID, name: "Activity Test" });
});

describe("recordActivity + listActivity", () => {
  it("writes a row that listActivity returns", async () => {
    await record({
      companyId: COMPANY_ID,
      refId: "action-roundtrip-1",
      refType: "action",
      summary: "Coisa aconteceu",
      type: "ACTION_EXECUTED",
    });
    const items = await list();
    expect(
      items.find((item) => item.summary === "Coisa aconteceu" && item.type === "ACTION_EXECUTED"),
    ).toMatchObject({ companyName: "Activity Test", refId: "action-roundtrip-1" });
  });

  it("filters by since", async () => {
    await record({
      companyId: COMPANY_ID,
      refId: "action-old",
      refType: "action",
      summary: "antiga",
      type: "ACTION_EXECUTED",
    });
    const [old] = await list();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10);
    });
    await record({
      companyId: COMPANY_ID,
      payload: { actionId: "a-new", summary: "draft" },
      refId: "a-new",
      refType: "action",
      summary: "nova",
      type: "ACTION_PROPOSED",
    });
    const recent = await list((old?.createdAt ?? 0) + 1);
    expect(recent.find((item) => item.type === "ACTION_PROPOSED")).toBeTruthy();
    expect(recent.find((item) => item.type === "ACTION_EXECUTED")).toBeUndefined();
  });

  it("propagates write failures to the caller", async () => {
    await expect(
      record({
        companyId: "co_activity_missing",
        refId: "action-broken",
        refType: "action",
        summary: "won't actually write",
        type: "ACTION_EXECUTED",
      }),
    ).rejects.toThrow(ACTIVITY_FOREIGN_KEY);
    await expect(list()).resolves.toEqual([]);
  });
});
