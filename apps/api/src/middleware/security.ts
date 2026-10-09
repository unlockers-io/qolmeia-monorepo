import { readForwardedClientIp } from "@repo/internal-auth";
import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { getSignedCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";

import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

const firstNonEmpty = (...candidates: Array<string | undefined>): string | undefined =>
  candidates.find((value) => value !== undefined && value !== "");

const verifiedSessionToken = async (c: Context): Promise<string | undefined> => {
  const { authCookies, secret } = await auth.$context;
  const token = await getSignedCookie(c, secret, authCookies.sessionToken.name);
  return typeof token === "string" ? firstNonEmpty(token) : undefined;
};

const edgeClientIp = (c: Context): string | undefined =>
  c.req.header("x-real-ip")?.split(",").at(-1)?.trim();

const rateLimitKey = async (c: Context): Promise<string> => {
  const sessionToken = await verifiedSessionToken(c);
  if (sessionToken !== undefined) {
    return `session:${sessionToken}`;
  }
  const clientIp =
    readForwardedClientIp(c.req.raw.headers, env.TRUSTED_PROXY_SECRET) ??
    firstNonEmpty(edgeClientIp(c)) ??
    "unknown";
  return `ip:${clientIp}`;
};

export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'"],
    frameSrc: ["'none'"],
    imgSrc: ["'self'", "data:", "https:"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
  crossOriginEmbedderPolicy: "require-corp",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "cross-origin",
  originAgentCluster: "?1",
  referrerPolicy: "no-referrer-when-downgrade",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xDnsPrefetchControl: "off",
  xDownloadOptions: "noopen",
  xFrameOptions: "DENY",
  xPermittedCrossDomainPolicies: "none",
  xXssProtection: "1; mode=block",
});

export const standardRateLimit = rateLimiter({
  handler: (c: Context) => {
    c.res = c.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
        },
      },
      429,
    );
  },
  keyGenerator: rateLimitKey,
  limit: 100,
  standardHeaders: "draft-6",
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const apiRateLimit = rateLimiter({
  handler: (c: Context) => {
    c.res = c.json(
      {
        error: {
          code: "API_RATE_LIMIT_EXCEEDED",
          message: "API rate limit exceeded, please slow down",
        },
      },
      429,
    );
  },
  keyGenerator: rateLimitKey,
  limit: 30,
  standardHeaders: "draft-6",
  windowMs: 1 * 60 * 1000, // 1 minute
});

export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header("content-length");

    if (
      contentLength !== undefined &&
      contentLength !== "" &&
      Math.trunc(Number(contentLength)) > maxSize
    ) {
      return c.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request entity too large",
          },
        },
        413,
      );
    }

    // oxlint-disable-next-line callback-return -- Hono middleware: the size guard returns early; nothing runs after next()
    await next();
    return undefined;
  };
};

export const requestId = (c: Context, next: Next) => {
  const id = firstNonEmpty(c.req.header("x-request-id")) ?? crypto.randomUUID();
  c.set("requestId", id);
  c.header("x-request-id", id);
  return next();
};
