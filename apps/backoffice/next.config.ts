import { createNextConfig } from "@repo/app-shell/next-config";
import { baseNextConfig } from "@repo/config-next";

export default createNextConfig(
  { urlEnvs: ["BACKOFFICE_URL"], workerPaths: ["/api/backoffice/:path*", "/assets/:id"] },
  {
    ...baseNextConfig("backoffice", {
      exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    }),
    transpilePackages: ["@repo/app-shell", "@repo/ui", "@repo/worker-api"],
  },
);
