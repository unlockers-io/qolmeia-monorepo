import { createNextConfig } from "@repo/app-shell/next-config";

export default createNextConfig({
  host: "qolmeia.backoffice",
  publicUrlEnv: "BACKOFFICE_URL",
  workerPaths: ["/api/backoffice/:path*", "/assets/:id"],
});
