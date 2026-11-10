import { createNextConfig } from "@repo/app-shell/next-config";

export default createNextConfig(
  { urlEnvs: ["NEXT_PUBLIC_LANDING_URL", "NEXT_PUBLIC_WEB_APP_URL"] },
  {
    allowedDevOrigins: ["qolmeia.landing.localhost", "*.qolmeia.landing.localhost", "*.vercel.app"],
    cacheComponents: true,

    experimental: {
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
    transpilePackages: ["@repo/app-shell", "@repo/ui"],
  },
);
