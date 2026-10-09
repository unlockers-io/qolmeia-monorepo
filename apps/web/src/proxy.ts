import { createProxy } from "@repo/app-shell/proxy";

export const proxy = createProxy({
  protectedRoutes: ["/", "/assets", "/activity", "/empresa", "/no-access"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|public).*)"],
};
