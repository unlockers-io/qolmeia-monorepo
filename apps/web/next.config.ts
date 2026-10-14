import { createNextConfig } from "@repo/app-shell/next-config";

export default createNextConfig({
  host: "qolmeia.web",
  publicUrlEnv: "WEB_APP_URL",
  workerPaths: ["/api/me", "/api/me/:path+", "/api/teams/:path*", "/agents/:path*", "/assets/:id"],
});
