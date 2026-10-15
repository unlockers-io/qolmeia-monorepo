import { cloudflare } from "@cloudflare/vite-plugin";
import { flue, flueWorkerConfig } from "@flue/vite";
import { applyPortlessUrls } from "@repo/portless-env";
import { defineConfig } from "vite";
import zodCompiler from "zod-compiler/vite";

const DEV_VARS = ["CORS_ORIGINS", "WEB_APP_URL", "WORKER_PUBLIC_URL"] as const;

export default defineConfig(({ command }) => {
  applyPortlessUrls(DEV_VARS);
  const fluePlugins = flue();
  const applyFlueWorkerConfig = flueWorkerConfig();

  return {
    plugins: [
      zodCompiler(),
      fluePlugins,
      cloudflare({
        config: (config) => {
          applyFlueWorkerConfig(config);
          if (command === "serve") {
            Reflect.deleteProperty(config, "ai");
            Reflect.deleteProperty(config, "vectorize");
            config.vars.MEMORY_BACKEND = "in-memory";
            for (const key of DEV_VARS) {
              const value = process.env[key];
              if (value) {
                config.vars[key] = value;
              }
            }
          }
        },
      }),
    ],
    // The entry is virtual, so Vite cannot crawl it and finds dependencies one reload at a time,
    // which crashes a cold start.
    environments: {
      worker_bees: { optimizeDeps: { entries: ["src/app.ts", "src/cloudflare.ts"] } },
    },
    server: { allowedHosts: [".localhost"], host: "127.0.0.1", port: 8787 },
  };
});
