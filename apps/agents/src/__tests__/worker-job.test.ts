import type { DecisionOutcome } from "@repo/worker-api/contracts";
import { introspectWorkflowInstance } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { db, seedCompany, seedTeam, seedTicket } from "#/__tests__/fixtures";
import { fetchWithCookie, signInAs } from "#/__tests__/sign-in";
import { actionIdFor, MAX_REVISIONS } from "#/action/action";
import { decisionEventType } from "#/jobs/decision";
import { listAssets } from "#/library/assets";

const COMPANY_ID = "co_worker_job";
const DESIGNER_ID = "agent-worker-job-designer";
const STRATEGIST_ID = "agent-worker-job-strategist";
const originalFetch = globalThis.fetch;

type ToolInput = Record<string, ReadonlyArray<string> | string>;

const toolInputs = (round: number): Partial<Record<string, ToolInput>> => ({
  draftSocialPost: {
    body: `Post da rodada ${round}`,
    callToAction: "Visite-nos",
    hashtags: ["cafe"],
    platform: "instagram",
    tone: "acolhedor",
  },
  saveAsset: { content: `Entrega da rodada ${round}`, name: `entrega-${round}.md` },
});

const toolSchema = z.object({ function: z.object({ name: z.string() }) });

const messageSchema = z.looseObject({ role: z.string() });

const completionSchema = z.object({
  messages: z.array(messageSchema),
  tools: z.array(toolSchema).default([]),
});

type ToolCall = { function: { arguments: string; name: string }; id: string; type: "function" };

type AssistantMessage = { content: string | null; role: "assistant"; tool_calls?: Array<ToolCall> };

const prompts: Array<string> = [];

const chatCompletion = (message: AssistantMessage, finishReason: "stop" | "tool_calls") =>
  Response.json({
    choices: [{ finish_reason: finishReason, index: 0, message }],
    created: 0,
    id: "gen-test",
    model: "test/model",
    object: "chat.completion",
    usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
  });

const callTools = (body: z.infer<typeof completionSchema>): Response => {
  prompts.push(JSON.stringify(body.messages));
  const round = prompts.length - 1;
  const inputs = toolInputs(round);
  const toolCalls = body.tools.flatMap(({ function: { name } }): Array<ToolCall> => {
    const input = inputs[name];
    const args = JSON.stringify(input);
    return input === undefined
      ? []
      : [{ function: { arguments: args, name }, id: `${name}-${round}`, type: "function" }];
  });
  return chatCompletion({ content: null, role: "assistant", tool_calls: toolCalls }, "tool_calls");
};

const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = new Request(input, init);
  if (!request.url.endsWith("/chat/completions")) {
    return new Response("unexpected request", { status: 500 });
  }
  const body = completionSchema.parse(await request.json());
  return body.messages.some(({ role }) => role === "tool")
    ? chatCompletion({ content: "Entrega pronta.", role: "assistant" }, "stop")
    : callTools(body);
};

const gateDesigner = () =>
  db((client) =>
    client.agentTemplate.update({
      data: { defaultPolicies: { worker_deliverable: "require_approval" } },
      where: { id: "tpl-designer" },
    }),
  );

const startJob = async (ticketId: string, agentInstanceId = DESIGNER_ID) => {
  await seedTicket({ agentInstanceId, companyId: COMPANY_ID, id: ticketId, workflowId: ticketId });
  const instance = await introspectWorkflowInstance(env.WORKER_JOB, ticketId);
  await env.WORKER_JOB.create({
    id: ticketId,
    params: { agentInstanceId, companyId: COMPANY_ID, ticketId },
  });
  return instance;
};

const decide = async (actionId: string, decision: DecisionOutcome, feedback?: string) =>
  fetchWithCookie(
    await signInAs({ orgId: "co_qolmeia", role: "STAFF", userId: "operator-1" }),
    `https://agents.test/api/backoffice/actions/${actionId}/decide`,
    {
      body: JSON.stringify({ decision, feedback }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );

const ticketRow = (ticketId: string) =>
  db((client) => client.ticket.findUniqueOrThrow({ where: { id: ticketId } }));

const actionRows = (ticketId: string) =>
  db((client) =>
    client.action.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, policy: true, status: true },
      where: { ticketId },
    }),
  );

const assetsByName = async () => {
  const assets = await db((client) => listAssets(client, COMPANY_ID));
  return new Map(assets.map((asset) => [asset.name, asset]));
};

const customerFolder = async () => {
  const assets = await db((client) => listAssets(client, COMPANY_ID, { visibility: "customer" }));
  return assets.map(({ id }) => id);
};

const activityTypes = async (ticketId: string) => {
  const rows = await db((client) =>
    client.activityLog.findMany({
      orderBy: { createdAt: "asc" },
      select: { type: true },
      where: { refId: { startsWith: ticketId } },
    }),
  );
  return rows.map(({ type }) => type);
};

beforeEach(async () => {
  prompts.length = 0;
  const stored = await env.ASSETS.list({ prefix: `org_${COMPANY_ID}/` });
  await env.ASSETS.delete(stored.objects.map(({ key }) => key));
  globalThis.fetch = vi.fn(fakeFetch);
  await db((client) => client.agentTemplate.updateMany({ data: { model: "test/model" } }));
  await seedCompany({ id: COMPANY_ID });
  await seedTeam(COMPANY_ID, [
    { id: DESIGNER_ID },
    { displayName: "Estrategista", id: STRATEGIST_ID, templateId: "tpl-marketing-strategist" },
  ]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("WorkerJobWorkflow", () => {
  it("auto-executes a deliverable straight into the customer folder", async () => {
    await using instance = await startJob("tkt-auto");
    await instance.waitForStatus("complete");

    expect(await instance.getOutput()).toEqual({
      actionId: actionIdFor("tkt-auto", 0),
      outcome: "executed",
      revisions: 0,
    });
    await expect(actionRows("tkt-auto")).resolves.toEqual([
      { id: actionIdFor("tkt-auto", 0), policy: "auto_execute", status: "executed" },
    ]);
    await expect(ticketRow("tkt-auto")).resolves.toMatchObject({
      result: { summary: "Entrega pronta." },
      status: "done",
    });
    const assets = await assetsByName();
    expect(assets.get("entrega-0.md")?.visibility).toBe("customer");
    await expect(customerFolder()).resolves.toHaveLength(1);
    await expect(activityTypes("tkt-auto")).resolves.toEqual(["ACTION_EXECUTED"]);
  });

  it("runs notify-only work immediately and leaves an operator spot-check entry", async () => {
    await db((client) =>
      client.agentTemplate.update({
        data: { defaultPolicies: { worker_deliverable: "notify_only" } },
        where: { id: "tpl-designer" },
      }),
    );
    await using instance = await startJob("tkt-notify");
    await instance.waitForStatus("complete");

    await expect(actionRows("tkt-notify")).resolves.toEqual([
      { id: actionIdFor("tkt-notify", 0), policy: "notify_only", status: "executed" },
    ]);
    await expect(activityTypes("tkt-notify")).resolves.toEqual(["ACTION_NOTIFY"]);
  });

  it("holds a gated deliverable in the agent folder until an Operator approves it", async () => {
    await gateDesigner();
    await using instance = await startJob("tkt-approve");
    const actionId = actionIdFor("tkt-approve", 0);
    await instance.waitForStepResult({ name: "propose-0" });

    await expect(ticketRow("tkt-approve")).resolves.toMatchObject({ status: "awaiting_approval" });
    const drafted = await assetsByName();
    expect(drafted.get("entrega-0.md")?.visibility).toBe("agent");
    await expect(customerFolder()).resolves.toEqual([]);

    const res = await decide(actionId, "approved");
    expect(res.status).toBe(200);
    await instance.waitForStatus("complete");

    expect(await instance.getOutput()).toEqual({ actionId, outcome: "executed", revisions: 0 });
    await expect(actionRows("tkt-approve")).resolves.toEqual([
      { id: actionId, policy: "require_approval", status: "executed" },
    ]);
    await expect(ticketRow("tkt-approve")).resolves.toMatchObject({ status: "done" });
    const released = await assetsByName();
    expect(released.get("entrega-0.md")?.visibility).toBe("customer");
    await expect(customerFolder()).resolves.toHaveLength(1);
    await expect(activityTypes("tkt-approve")).resolves.toEqual([
      "ACTION_PROPOSED",
      "ACTION_APPROVED",
      "ACTION_EXECUTED",
    ]);
  });

  it("ends the Ticket on reject and never releases its assets to the customer", async () => {
    await gateDesigner();
    await using instance = await startJob("tkt-reject");
    const actionId = actionIdFor("tkt-reject", 0);
    await instance.waitForStepResult({ name: "propose-0" });

    const rejected = await decide(actionId, "rejected", "Fora da marca.");
    expect(rejected.status).toBe(200);
    await instance.waitForStatus("complete");

    expect(await instance.getOutput()).toEqual({ actionId, outcome: "ended", revisions: 0 });
    await expect(actionRows("tkt-reject")).resolves.toEqual([
      { id: actionId, policy: "require_approval", status: "rejected" },
    ]);
    await expect(ticketRow("tkt-reject")).resolves.toMatchObject({
      result: null,
      status: "rejected",
    });
    const assets = await assetsByName();
    expect(assets.get("entrega-0.md")?.visibility).toBe("agent");
    await expect(customerFolder()).resolves.toEqual([]);
  });

  it("revises on request-changes and releases only the approved round", async () => {
    await gateDesigner();
    await using instance = await startJob("tkt-revise");
    await instance.waitForStepResult({ name: "propose-0" });

    const first = actionIdFor("tkt-revise", 0);
    const revise = await decide(first, "changes_requested", "Use tons de verde.");
    expect(revise.status).toBe(200);
    await instance.waitForStepResult({ name: "propose-1" });
    expect(prompts[1]).toContain("Use tons de verde.");
    await expect(ticketRow("tkt-revise")).resolves.toMatchObject({ status: "awaiting_approval" });

    const second = actionIdFor("tkt-revise", 1);
    const approve = await decide(second, "approved");
    expect(approve.status).toBe(200);
    await instance.waitForStatus("complete");

    expect(await instance.getOutput()).toEqual({
      actionId: second,
      outcome: "executed",
      revisions: 1,
    });
    await expect(actionRows("tkt-revise")).resolves.toEqual([
      { id: first, policy: "require_approval", status: "changes_requested" },
      { id: second, policy: "require_approval", status: "executed" },
    ]);
    const assets = await assetsByName();
    expect(assets.get("entrega-0.md")?.visibility).toBe("agent");
    expect(assets.get("entrega-1.md")?.visibility).toBe("customer");
  });

  it("ends the Ticket when changes are requested past the revision cap", async () => {
    await gateDesigner();
    await using instance = await startJob("tkt-cap");
    const workflow = await env.WORKER_JOB.get("tkt-cap");

    for (let round = 0; round <= MAX_REVISIONS; round += 1) {
      await instance.waitForStepResult({ name: `propose-${round}` });
      const actionId = actionIdFor("tkt-cap", round);
      if (round === MAX_REVISIONS) {
        const refused = await decide(actionId, "changes_requested", "mais um ajuste");
        expect(refused.status).toBe(409);
      }
      await workflow.sendEvent({
        payload: {
          decidedByUserId: "operator-1",
          decision: "changes_requested",
          feedback: "ajuste",
        },
        type: decisionEventType(actionId),
      });
    }
    await instance.waitForStatus("complete");

    expect(await instance.getOutput()).toEqual({
      actionId: actionIdFor("tkt-cap", MAX_REVISIONS),
      outcome: "ended",
      revisions: MAX_REVISIONS,
    });
    expect(prompts).toHaveLength(MAX_REVISIONS + 1);
    await expect(ticketRow("tkt-cap")).resolves.toMatchObject({ status: "rejected" });
    await expect(customerFolder()).resolves.toEqual([]);
  });

  it("presents the approved draft when a publish_post Action executes", async () => {
    await using instance = await startJob("tkt-post", STRATEGIST_ID);
    const actionId = actionIdFor("tkt-post", 0);
    await instance.waitForStepResult({ name: "propose-0" });

    const pending = await db((client) =>
      client.action.findUniqueOrThrow({ select: { proposed: true }, where: { id: actionId } }),
    );
    expect(pending.proposed).toMatchObject({
      draft: { body: "Post da rodada 0", platform: "instagram" },
      summary: "Entrega pronta.",
    });

    const approved = await decide(actionId, "approved");
    expect(approved.status).toBe(200);
    await instance.waitForStatus("complete");

    const ticket = await ticketRow("tkt-post");
    expect(ticket.status).toBe("done");
    expect(ticket.result).toEqual({
      summary: "**Post para Instagram**\n\nPost da rodada 0\n\nVisite-nos\n\n#cafe",
    });
  });
});

describe("decide route", () => {
  it("refuses a decision on an Action that is no longer pending", async () => {
    await gateDesigner();
    await using instance = await startJob("tkt-twice");
    const actionId = actionIdFor("tkt-twice", 0);
    await instance.waitForStepResult({ name: "propose-0" });

    const first = await decide(actionId, "approved");
    expect(first.status).toBe(200);
    await instance.waitForStatus("complete");
    const again = await decide(actionId, "rejected");
    expect(again.status).toBe(409);
  });
});
