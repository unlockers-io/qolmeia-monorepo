import { createProxy } from "@repo/app-shell/proxy";

import { PROTECTED_ROUTES } from "@/lib/routes";

export const proxy = createProxy({ protectedRoutes: PROTECTED_ROUTES });

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
