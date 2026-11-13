import { createNextConfig } from "@repo/app-shell/next-config";
import { baseNextConfig } from "@repo/config-next";

export default createNextConfig(
  {
    urlEnvs: ["WEB_APP_URL"],
    workerPaths: ["/api/me", "/api/me/:path+", "/agents/:path*", "/assets/:id"],
  },
  {
    ...baseNextConfig("web", {
      exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    }),
    transpilePackages: ["@repo/app-shell", "@repo/ui", "@repo/worker-api"],
  },
);
