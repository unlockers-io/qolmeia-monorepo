/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";
import { portlessUrl } from "@repo/portless-env";
import { apps, loopbackUrl, type App } from "@repo/portless-env/apps";

const localUrl = (app: App): string | undefined => {
  if (process.env.CI) {
    return undefined;
  }

  try {
    return portlessUrl(app);
  } catch {
    return undefined;
  }
};

const appUrl = (app: App, override: string | undefined): string =>
  override ?? localUrl(app) ?? loopbackUrl(app, "127.0.0.1");

const backofficeUrl = appUrl("backoffice", process.env.E2E_BACKOFFICE_URL);

const webUrl = appUrl("web", process.env.E2E_WEB_URL);

const landingUrl = appUrl("landing", process.env.E2E_LANDING_URL);

const nextStart = (app: Exclude<App, "agents">): string =>
  `node_modules/.bin/next start apps/${app} --port ${apps[app].port} --hostname 127.0.0.1`;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  globalTeardown: "./tests/e2e/teardown/cleanup.ts",

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/u, use: { baseURL: backofficeUrl } },
    {
      dependencies: ["setup"],
      name: "chromium",
      testIgnore: /.*\/auth-email\/.*/u,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
    {
      name: "auth-email",
      testMatch: /.*\/auth-email\/.*/u,
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.CI
      ? []
      : [
          {
            dependencies: ["setup"],
            name: "firefox",
            testIgnore: /.*\/auth-email\/.*/u,
            use: {
              ...devices["Desktop Firefox"],
              storageState: "tests/e2e/.auth/user.json",
            },
          },
          {
            dependencies: ["setup"],
            name: "webkit",
            testIgnore: /.*\/auth-email\/.*/u,
            use: {
              ...devices["Desktop Safari"],
              storageState: "tests/e2e/.auth/user.json",
            },
          },
        ]),
  ],

  reporter: process.env.CI ? [["html", { open: "never" }]] : [["list"], ["html"]],
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",

  use: {
    baseURL: backofficeUrl,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },

  webServer: process.env.CI
    ? [
        {
          command: "node tests/e2e/support/resend-stub.ts",
          stderr: "pipe",
          stdout: "pipe",
          url: `${process.env.RESEND_BASE_URL}/emails`,
        },
        {
          command: "pnpm --filter worker-bees exec vite dev",
          env: {
            CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
              process.env.DATABASE_URL ?? "",
          },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: `${loopbackUrl("agents", "127.0.0.1")}/healthz`,
        },
        {
          command: nextStart("backoffice"),
          env: { PGAPPNAME: "qolmeia:ci:backoffice" },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: `${backofficeUrl}/login`,
        },
        {
          command: nextStart("web"),
          env: { PGAPPNAME: "qolmeia:ci:web" },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: `${webUrl}/login`,
        },
        {
          command: nextStart("landing"),
          env: { PGAPPNAME: "qolmeia:ci:landing" },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: landingUrl,
        },
      ]
    : [],

  workers: process.env.CI ? 1 : undefined,
});

export { backofficeUrl, landingUrl, webUrl };
