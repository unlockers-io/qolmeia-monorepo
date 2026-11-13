import type { IncomingMessage, ServerResponse } from "node:http";
import { json } from "node:stream/consumers";

import { cloudflare } from "@cloudflare/vite-plugin";
import { flue, flueWorkerConfig } from "@flue/vite";
import { applyPortlessUrls } from "@repo/portless-env";
import { apps, loopbackUrl } from "@repo/portless-env/apps";
import { createTransport } from "@repo/transactional/transport";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { z } from "zod";
import zodCompiler from "zod-compiler/vite";

const DEV_VARS = ["CORS_ORIGINS", "WEB_APP_URL", "WORKER_PUBLIC_URL"] as const;

const FORWARDED_VARS = [...DEV_VARS, "MAIL_TRANSPORT"] as const;

const MAIL_OUTBOX_PATH = "/__mail-outbox";

const outboxMessageSchema = z.object({
  from: z.string(),
  html: z.string(),
  subject: z.string(),
  text: z.string(),
  to: z.string(),
});

// workerd cannot write host files, so the Worker posts its outbox mail here and this process files it.
const mailOutbox = (): Plugin => ({
  apply: "serve",
  configureServer: (server) => {
    const outbox = createTransport({ apiKey: undefined, transport: "outbox" });

    const fileMessage = async (request: IncomingMessage, response: ServerResponse) => {
      try {
        const result = await outbox(outboxMessageSchema.parse(await json(request)));

        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(result));
      } catch (error) {
        response.statusCode = 500;
        response.end(error instanceof Error ? error.message : "The outbox refused the message");
      }
    };

    server.middlewares.use(MAIL_OUTBOX_PATH, (request, response) => {
      void fileMessage(request, response);
    });
  },
  name: "mail-outbox",
});

export default defineConfig(({ command }) => {
  applyPortlessUrls(DEV_VARS);
  const fluePlugins = flue();
  const applyFlueWorkerConfig = flueWorkerConfig();

  return {
    plugins: [
      zodCompiler(),
      fluePlugins,
      mailOutbox(),
      cloudflare({
        config: (config) => {
          applyFlueWorkerConfig(config);

          if (command === "serve") {
            Reflect.deleteProperty(config, "ai");
            Reflect.deleteProperty(config, "vectorize");
            config.vars.MEMORY_BACKEND = "in-memory";
            config.vars.MAIL_OUTBOX_URL = `${loopbackUrl("agents", "127.0.0.1")}${MAIL_OUTBOX_PATH}`;

            for (const key of FORWARDED_VARS) {
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
    server: { allowedHosts: [".localhost"], host: "127.0.0.1", port: apps.agents.port },
  };
});
