import "#/lib/observability";

import { setProvider } from "@flue/runtime";
import { createAgentRouter } from "@flue/runtime/routing";
import { log } from "@repo/observability";
import { honoEvlog } from "@repo/observability/hono";
import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { CorrespondentV2 } from "#/agents/correspondent";
import { PlannerV2 } from "#/agents/planner";
import { requireCustomerOfPathTenant, type IdentityEnv } from "#/identity/gates";
import { authRoutes } from "#/lib/auth";
import { dbPerRequest } from "#/lib/db";
import { conversationProvider } from "#/lib/models";
import { assetsRoutes } from "#/routes/assets";
import { backofficeRoutes } from "#/routes/backoffice";
import { meRoutes } from "#/routes/me";
import { signupRoutes } from "#/routes/signup";
import { teamsRoutes } from "#/routes/teams";

setProvider(conversationProvider(env));

const app = new Hono<IdentityEnv>();

app.use("*", honoEvlog());

app.use("*", async (c, next) => {
  // oxlint-disable-next-line callback-return -- Hono after-middleware: headers are set post-next()
  await next();
  if (c.res.headers.get("content-type")?.startsWith("text/event-stream") === true) {
    c.res.headers.set("cache-control", "no-cache, no-transform");
  }
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
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
app.route("/api/auth", authRoutes);
app.route("/api/signup", signupRoutes);
app.route("/api/backoffice", backofficeRoutes);
app.route("/api/me", meRoutes);
app.route("/api/teams", teamsRoutes);
app.route("/assets", assetsRoutes);

app.use("/agents/*", dbPerRequest, requireCustomerOfPathTenant);
app.route("/agents/correspondent", createAgentRouter(CorrespondentV2));
app.route("/agents/planner", createAgentRouter(PlannerV2));

export default app;
