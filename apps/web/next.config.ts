import { createNextConfig } from "@repo/app-shell/next-config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...createNextConfig({
    publicUrlEnv: "WEB_APP_URL",
    workerPaths: [
      "/api/me",
      "/api/me/:path+",
      "/api/teams/:path*",
      "/agents/:path*",
      "/assets/:id",
    ],
  }),

  allowedDevOrigins: ["qolmeia.web.localhost", "*.qolmeia.web.localhost", "*.vercel.app"],
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

  transpilePackages: ["@repo/app-shell", "@repo/ui", "@repo/worker-api"],
};

export default nextConfig;
