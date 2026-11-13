import { withClientIp } from "@repo/auth/client-ip";
import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth } from "@repo/auth/server";
import { Hono } from "hono";

import type { DbVariables, PrismaClient } from "#/lib/db";
import { mailTransport } from "#/lib/mail";

const createWorkerAuth = (env: Env, db: PrismaClient) =>
  createAuth({
    ...envAuthConfig(),
    fallbackBaseURL: env.WORKER_PUBLIC_URL,
    prisma: db,
    secret: env.BETTER_AUTH_SECRET,
    transport: mailTransport(env),
  });

type WorkerAuth = ReturnType<typeof createWorkerAuth>;

const authRoutes = new Hono<{ Bindings: Env; Variables: DbVariables }>();

authRoutes.on(["GET", "POST"], "/*", (c) =>
  createWorkerAuth(c.env, c.var.db).handler(withClientIp(c.req.raw, c.env.TRUSTED_PROXY_SECRET)),
);

export { authRoutes, createWorkerAuth };

export type { WorkerAuth };
