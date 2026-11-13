import { builtinModules } from "node:module";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import { unstable_readConfig } from "wrangler";
import { z } from "zod";

import { testDatabaseUrl } from "./src/__tests__/test-database";

const cronsSchema = z.array(z.string());

const vectorizeSchema = z.array(z.object({ index_name: z.string() }));

const wranglerSchema = z.object({
  triggers: z.object({ crons: cronsSchema }),
  vectorize: vectorizeSchema,
});

const wrangler = wranglerSchema.parse(unstable_readConfig({ config: "./wrangler.jsonc" }));

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/__tests__/worker-entry.ts",
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET: "vitest-better-auth-secret-of-at-least-32-chars",
          MAIL_OUTBOX_URL: "http://outbox.test/",
          MAIL_TRANSPORT: "outbox",
          OPENROUTER_API_KEY: "test-openrouter-key",
        },
        hyperdrives: { HYPERDRIVE: testDatabaseUrl },
      },
      wrangler: { configPath: "./wrangler.jsonc", environment: "test" },
    }),
  ],
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
    provide: {
      wranglerCrons: wrangler.triggers.crons,
      wranglerVectorIndexes: wrangler.vectorize.map(({ index_name }) => index_name),
    },
    setupFiles: ["./src/__tests__/reset-database.ts"],
    testTimeout: 20_000,
  },
});
