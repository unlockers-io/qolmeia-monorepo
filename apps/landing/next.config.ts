import { createNextConfig } from "@repo/app-shell/next-config";
import { baseNextConfig } from "@repo/config-next";

export default createNextConfig(
  { urlEnvs: ["NEXT_PUBLIC_LANDING_URL", "NEXT_PUBLIC_WEB_APP_URL"] },
  {
    ...baseNextConfig("landing", {}),
    transpilePackages: ["@repo/app-shell", "@repo/ui"],
  },
);
