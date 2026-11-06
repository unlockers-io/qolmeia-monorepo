import { forwardClientIp } from "@repo/auth/client-ip";
import { loginHref } from "@repo/auth/redirect-path";
import { hasSessionCookie } from "@repo/auth/session-cookie";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { matchesRoute } from "./match-route";

type ProxyConfig = { protectedRoutes: ReadonlyArray<string> };

/**
 * Vercel overwrites x-forwarded-for with the address it accepted the connection from, so the
 * browser cannot choose it. The secret lets the Worker tell this hop from a direct caller.
 */
const forwardAuthRequest = (request: NextRequest): NextResponse => {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const secret = process.env.TRUSTED_PROXY_SECRET ?? "";

  if (clientIp === "" || secret === "") {
    return NextResponse.next();
  }

  return NextResponse.next({
    request: { headers: forwardClientIp(request.headers, { clientIp, secret }) },
  });
};

/**
 * Only an optimistic check: a page still asks the Worker who the caller is, and a stale cookie
 * is sent to /login from there.
 */
const createProxy =
  ({ protectedRoutes }: ProxyConfig) =>
  (request: NextRequest): NextResponse => {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/api/auth/")) {
      return forwardAuthRequest(request);
    }

    const isProtected = protectedRoutes.some((route) => matchesRoute(pathname, route));

    if (isProtected && !hasSessionCookie(request.headers)) {
      return NextResponse.redirect(new URL(loginHref(pathname), request.url));
    }

    return NextResponse.next();
  };

export { createProxy };
