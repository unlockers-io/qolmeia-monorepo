import { createProxy } from "@repo/app-shell/proxy";

export const proxy = createProxy({
  protectedRoutes: [
    "/",
    "/approvals",
    "/activity",
    "/cobertura",
    "/teams",
    "/templates",
    "/tickets",
  ],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
