import "#/lib/observability";

import { setProvider, type Agent } from "@flue/runtime";
import { createAgentRouter } from "@flue/runtime/routing";
import { log } from "@repo/observability";
import { honoEvlog } from "@repo/observability/hono";
import type { ConversationAgent } from "@repo/worker-api/contracts";
import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { CorrespondentV2 } from "#/agents/correspondent";
import { PlannerV2 } from "#/agents/planner";
import { requireCustomerOfPathTenant, type IdentityEnv } from "#/identity/gates";
import { authRoutes } from "#/lib/auth";
import { dbPerRequest } from "#/lib/db";
import { DomainError } from "#/lib/errors";
import { conversationProvider } from "#/lib/models";
import { assetsRoutes } from "#/routes/assets";
import { backofficeRoutes } from "#/routes/backoffice";
import { identityRoutes } from "#/routes/identity";
import { customerRoutes } from "#/routes/me";
import { signupRoutes } from "#/routes/signup";

setProvider(conversationProvider(env));

const app = new Hono<IdentityEnv>();

app.use("*", honoEvlog());

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.res === undefined
      ? c.json({ error: error.message }, error.status)
      : error.getResponse();
  }

  if (error instanceof DomainError) {
    return c.json({ error: error.message }, error.status);
  }

  log.error({
    error: error instanceof Error ? error.message : String(error),
    message: "worker.unhandled",
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });

  return c.json({ error: "internal error" }, 500);
});

app.get("/healthz", (c) => c.json({ status: "ok" }));

app.use("*", dbPerRequest);

app.route("/api/auth", authRoutes);

app.route("/api/signup", signupRoutes);

app.route("/api/backoffice", backofficeRoutes);

// The customer router's gate also matches `/api/me` itself, so the identity route answers first.
app.route("/api/me", identityRoutes);

app.route("/api/me", customerRoutes);

app.route("/assets", assetsRoutes);

app.use("/agents/*", async (c, next) => {
  // oxlint-disable-next-line callback-return -- Hono after-middleware: headers are set post-next()
  await next();

  if (c.res.headers.get("content-type")?.startsWith("text/event-stream") === true) {
    c.res.headers.set("cache-control", "no-cache, no-transform");
  }
});

app.use("/agents/:agent", requireCustomerOfPathTenant);

app.use("/agents/:agent/:companyId/*", requireCustomerOfPathTenant);

const CONVERSATION_AGENT_MODULES = {
  correspondent: CorrespondentV2,
  planner: PlannerV2,
} satisfies Record<ConversationAgent, Agent>;

for (const [name, agent] of Object.entries(CONVERSATION_AGENT_MODULES)) {
  app.route(`/agents/${name}`, createAgentRouter(agent));
}

export default app;
