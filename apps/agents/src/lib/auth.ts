import { withClientIp } from "@repo/auth/client-ip";
import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth } from "@repo/auth/server";
import { Hono } from "hono";

import { withDb, type PrismaClient } from "#/lib/db";

const createWorkerAuth = (env: Env, db: PrismaClient) =>
  createAuth({
    ...envAuthConfig(env),
    fallbackBaseURL: env.WORKER_PUBLIC_URL,
    prisma: db,
    rateLimitEnabled: process.env.NODE_ENV === "production",
    resendApiKey: env.RESEND_API_KEY,
    secret: env.BETTER_AUTH_SECRET,
  });

type WorkerAuth = ReturnType<typeof createWorkerAuth>;

const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.on(["GET", "POST"], "/*", (c) =>
  withDb(c.env, (db) =>
    createWorkerAuth(c.env, db).handler(withClientIp(c.req.raw, c.env.TRUSTED_PROXY_SECRET)),
  ),
);

export { authRoutes, createWorkerAuth };
export type { WorkerAuth };
