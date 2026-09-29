import { LOCAL_TEST_DATABASE_URL } from "@repo/config-vitest/database";
import nodeConfig from "@repo/config-vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: { env: { DATABASE_URL: process.env.DATABASE_URL ?? LOCAL_TEST_DATABASE_URL } },
  }),
);
