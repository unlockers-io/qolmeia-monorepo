import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { db, entitle, seedCompany, seedTeam } from "#/__tests__/fixtures";
import type { Actor } from "#/identity/identity";
import { hireMember, setMemberStatus, updateMember } from "#/team/members";

const COMPANY_ID = "co_hire_test";
const CORR_ID = `corr-${COMPANY_ID}`;
const CUSTOMER: Actor = { surface: "customer", userId: "user-1" };

const hire = (displayName?: string, templateId = "tpl-designer") =>
  db((client) =>
    hireMember(env, client, { actor: CUSTOMER, companyId: COMPANY_ID, displayName, templateId }),
  );

const setStatus = (agentInstanceId: string, status: "active" | "paused") =>
  db((client) =>
    setMemberStatus(env, client, {
      actor: CUSTOMER,
      agentInstanceId,
      companyId: COMPANY_ID,
      status,
    }),
  );

const update = (
  agentInstanceId: string,
  patch: { displayName?: string; promptOverride?: string | null },
  actor: Actor = CUSTOMER,
) =>
  db((client) =>
    updateMember(env, client, { ...patch, actor, agentInstanceId, companyId: COMPANY_ID }),
  );

const activity = (refId: string, type: string) =>
  db((client) =>
    client.activityLog.findFirst({
      select: { actorId: true, summary: true },
      where: { refId, type },
    }),
  );

beforeEach(async () => {
  await seedCompany({ id: COMPANY_ID });
  await entitle(COMPANY_ID);
  await seedTeam(COMPANY_ID);
});

describe("hireMember", () => {
  it("creates a new agent_instance and puts it on the team", async () => {
    const member = await hire();
    expect(member.displayName).toBe("Designer");
    expect(member.role).toBe("worker");
    expect(member.templateId).toBe("tpl-designer");

    await expect(
      db((client) => client.teamMember.count({ where: { agentInstanceId: member.id } })),
    ).resolves.toBe(1);
  });

  it("allows multi-hire of the same template with auto-numbered name", async () => {
    const first = await hire();
    const second = await hire();
    expect(first.displayName).toBe("Designer");
    expect(second.displayName).toBe("Designer #2");
    expect(second.id).not.toBe(first.id);
  });

  it("gives concurrent hires of the same template distinct names", async () => {
    const members = await Promise.all([hire(), hire(), hire()]);

    expect(members.map(({ displayName }) => displayName).toSorted()).toEqual([
      "Designer",
      "Designer #2",
      "Designer #3",
    ]);
  });

  it("uses a provided displayName when present", async () => {
    const member = await hire("Marina");
    expect(member.displayName).toBe("Marina");
  });

  it("writes MEMBER_HIRED activity row", async () => {
    const member = await hire();
    await expect(activity(member.id, "MEMBER_HIRED")).resolves.not.toBeNull();
  });

  it("rejects unknown templates with a clear error", async () => {
    await expect(hire(undefined, "tpl-nope")).rejects.toThrow(/template.*tpl-nope/v);
  });

  it("rejects a hire before the team is confirmed", async () => {
    await db((client) => client.team.deleteMany({ where: { companyId: COMPANY_ID } }));
    await expect(hire()).rejects.toThrow(/team not confirmed/v);
  });
});

describe("setMemberStatus", () => {
  it("pauses a worker and writes activity", async () => {
    const member = await hire();
    const paused = await setStatus(member.id, "paused");
    expect(paused.status).toBe("paused");
    const row = await db((client) => client.agentInstance.findUnique({ where: { id: member.id } }));
    expect(row?.status).toBe("paused");
    await expect(activity(member.id, "MEMBER_PAUSED")).resolves.not.toBeNull();
  });

  it("resumes a paused worker", async () => {
    const member = await hire();
    await setStatus(member.id, "paused");
    const resumed = await setStatus(member.id, "active");
    expect(resumed.status).toBe("available");
    await expect(activity(member.id, "MEMBER_RESUMED")).resolves.toEqual({
      actorId: "user-1",
      summary: `${member.displayName} foi retomado.`,
    });
  });

  it("rejects pausing the correspondent", async () => {
    await expect(setStatus(CORR_ID, "paused")).rejects.toThrow(/correspondent/v);
  });

  it("is idempotent (pausing twice returns paused without error)", async () => {
    const member = await hire();
    await setStatus(member.id, "paused");
    const again = await setStatus(member.id, "paused");
    expect(again.status).toBe("paused");
  });
});

describe("updateMember", () => {
  it("renames a worker and logs the caller as its actor", async () => {
    const member = await hire();
    const updated = await update(member.id, { displayName: "Marina" });
    expect(updated.displayName).toBe("Marina");
    await expect(activity(member.id, "MEMBER_RENAMED")).resolves.toMatchObject({
      actorId: "user-1",
    });
  });

  it("sets the prompt override and logs MEMBER_PROMPT_EDITED", async () => {
    const member = await hire();

    const updated = await update(
      member.id,
      { promptOverride: "Seja minimalista, monocromático." },
      { surface: "operator", userId: "user-staff-1" },
    );

    expect(updated.hasPromptOverride).toBe(true);
    await expect(activity(member.id, "MEMBER_PROMPT_EDITED")).resolves.toMatchObject({
      actorId: "user-staff-1",
    });
  });

  it("clears the prompt override when promptOverride is null + logs MEMBER_PROMPT_RESET", async () => {
    const member = await hire();
    await update(member.id, { promptOverride: "anything" });
    const cleared = await update(member.id, { promptOverride: null });
    expect(cleared.hasPromptOverride).toBe(false);
    await expect(activity(member.id, "MEMBER_PROMPT_RESET")).resolves.not.toBeNull();
  });

  it("accepts both fields in one call", async () => {
    const member = await hire();
    const updated = await update(member.id, { displayName: "Carla", promptOverride: "boa noite" });
    expect(updated.displayName).toBe("Carla");
    expect(updated.hasPromptOverride).toBe(true);
  });
});
