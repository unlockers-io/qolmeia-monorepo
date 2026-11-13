import { applyPortlessUrls } from "@repo/portless-env";
import type { UrlEnvKey } from "@repo/portless-env/apps";
import type { NextConfig } from "next";

import { agentsServerUrl } from "./agents-url";

type AppConfig = {
  /** env vars holding this app's own URLs */
  urlEnvs: ReadonlyArray<UrlEnvKey>;
  /** Worker routes the browser reaches through this origin, besides /api/auth */
  workerPaths?: ReadonlyArray<string>;
};

const workerRewrites = (workerPaths: ReadonlyArray<string>): NextConfig["rewrites"] => {
  const agentsUrl = agentsServerUrl();

  return () =>
    Promise.resolve(
      ["/api/auth/:path*", ...workerPaths].map((source) => ({
        destination: `${agentsUrl}${source}`,
        source,
      })),
    );
};

/**
 * `appConfig` is the app's own config: the base from `@repo/config-next` and what the app adds.
 * An app with Worker paths sends the browser only to its own origin, so the session cookie stays
 * host-only on it; `next build` bakes AGENTS_INTERNAL_URL into the rewrites.
 */
const createNextConfig = (
  { urlEnvs, workerPaths = [] }: AppConfig,
  appConfig: NextConfig,
): NextConfig => {
  const rewritesWorker = workerPaths.length > 0;
  applyPortlessUrls(rewritesWorker ? ["AGENTS_INTERNAL_URL", ...urlEnvs] : urlEnvs);

  return {
    ...appConfig,
    agentRules: false,
    experimental: {
      instantInsights: { validationLevel: "manual-warning" },
      ...appConfig.experimental,
    },
    rewrites: rewritesWorker ? workerRewrites(workerPaths) : undefined,
    turbopack: {
      rules: {
        "*.{ts,tsx}": {
          condition: {
            // oxlint-disable-next-line require-unicode-regexp -- Turbopack rejects the v flag in loader conditions
            all: [{ not: "foreign" }, { content: /[Zz]od/ }],
          },
          loaders: ["zod-compiler/turbopack"],
        },
      },
    },
  };
};

export { createNextConfig };
