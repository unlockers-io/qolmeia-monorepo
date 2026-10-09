import { readSession } from "@repo/app-shell/auth-server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { log } from "@/lib/observability";

const protectedRoutes = ["/", "/assets", "/activity", "/empresa", "/no-access"];

const authRoutes = ["/login", "/auth/verify"];

const matchesRoute = (pathname: string, route: string): boolean => {
  if (route === "/") {
    return pathname === "/";
  }
  return pathname === route || pathname.startsWith(`${route}/`);
};

const getSessionOrUnavailable = async (request: NextRequest) => {
  try {
    return await readSession(request.headers);
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "proxy: getSession failed; leaving the decision to the route",
      pathname: request.nextUrl.pathname,
    });
    return "unavailable" as const;
  }
};

export const proxy = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  const isProtectedRoute = protectedRoutes.some((route) => matchesRoute(pathname, route));
  const isAuthRoute = authRoutes.some((route) => matchesRoute(pathname, route));

  if (!isProtectedRoute && !isAuthRoute) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/auth/verify")) {
    return NextResponse.next();
  }

  const session = await getSessionOrUnavailable(request);

  if (session === "unavailable") {
    return NextResponse.next();
  }

  if (isProtectedRoute && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && session) {
    const url = new URL("/", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|public).*)"],
};
