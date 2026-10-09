import { builtinModules } from "node:module";
import path from "node:path";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./src/__tests__/test-database";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/__tests__/worker-entry.ts",
      miniflare: {
        bindings: {
          ASSETS_SIGNING_KEY: "vitest-assets-signing-key",
          OPENROUTER_API_KEY: "test-openrouter-key",
        },
        hyperdrives: { HYPERDRIVE: testDatabaseUrl },
      },
      wrangler: { configPath: "./wrangler.jsonc", environment: "test" },
    }),
  ],
  resolve: {
    alias: { "@": path.join(import.meta.dirname, "src") },
  },
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ["pg"],
          rolldownOptions: { external: [...builtinModules] },
        },
      },
    },
    fileParallelism: false,
    globalSetup: ["./src/__tests__/global-setup.ts"],
    setupFiles: ["./src/__tests__/reset-database.ts"],
    testTimeout: 20_000,
  },
});
