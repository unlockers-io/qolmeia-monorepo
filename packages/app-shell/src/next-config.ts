import { applyPortlessUrls } from "@repo/portless-env";
import type { NextConfig } from "next";

import { agentsServerUrl } from "./agents-url";

type AppConfig = {
  /** portless name of this app, e.g. "qolmeia.web" */
  host: string;
  /** env var that holds this app's public URL */
  publicUrlEnv: string;
  /** Worker routes the browser reaches through this origin, besides /api/auth */
  workerPaths: ReadonlyArray<string>;
};

/**
 * The browser only talks to this app's origin, so the session cookie stays host-only on it.
 * `next build` bakes AGENTS_INTERNAL_URL into the rewrites.
 */
const createNextConfig = ({ host, publicUrlEnv, workerPaths }: AppConfig): NextConfig => {
  applyPortlessUrls({ AGENTS_INTERNAL_URL: ["qolmeia.agents"], [publicUrlEnv]: [host] });
  const agentsUrl = agentsServerUrl();

  return {
    allowedDevOrigins: [`${host}.localhost`, `*.${host}.localhost`, "*.vercel.app"],
    cacheComponents: true,

    experimental: {
      exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
      instantInsights: { validationLevel: "manual-warning" },
      turbopackRustReactCompiler: true,
    },

    headers: () =>
      Promise.resolve([
        {
          headers: [
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ],
          source: "/:path*",
        },
      ]),

    partialPrefetching: true,
    reactCompiler: true,
    reactStrictMode: true,

    rewrites: () =>
      Promise.resolve(
        ["/api/auth/:path*", ...workerPaths].map((source) => ({
          destination: `${agentsUrl}${source}`,
          source,
        })),
      ),

    transpilePackages: ["@repo/app-shell", "@repo/ui", "@repo/worker-api"],
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
