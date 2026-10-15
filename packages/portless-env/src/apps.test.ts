import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { apps, canonicalHostname, canonicalUrl, canonicalUrls, loopbackUrl } from "./apps";

const appIds = ["agents", "backoffice", "landing", "web"] as const;

const repoFile = (path: string) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("registry", () => {
  it("derives each app's canonical URL from its portless name", () => {
    expect(appIds.map(canonicalUrl)).toEqual([
      "https://qolmeia.agents.localhost",
      "https://qolmeia.backoffice.localhost",
      "https://qolmeia.landing.localhost",
      "https://qolmeia.web.localhost",
    ]);
  });

  it("derives URL env defaults from the apps that fill them", () => {
    expect(canonicalUrls("CORS_ORIGINS")).toEqual([
      canonicalUrl("web"),
      canonicalUrl("backoffice"),
    ]);
    expect(canonicalUrls("WEB_APP_URL")).toEqual([canonicalUrl("web")]);
  });

  it("lists every app", () => {
    expect(Object.keys(apps)).toEqual(appIds);
  });

  it("serves each app on its own loopback port", () => {
    expect(loopbackUrl("agents", "127.0.0.1")).toBe("http://127.0.0.1:8787");
    expect(new Set(appIds.map((app) => apps[app].port)).size).toBe(appIds.length);
  });
});

describe("literals that cannot import the registry", () => {
  it.each(appIds)("runs the %s dev script under its portless name", async (app) => {
    const { scripts } = JSON.parse(await repoFile(`apps/${app}/package.json`));
    expect(scripts.dev).toMatch(new RegExp(`^portless run --name ${apps[app].name} `));
  });

  it.each(["backoffice", "landing", "web"] as const)(
    "allows the %s dev origins in next.config.ts",
    async (app) => {
      const config = await repoFile(`apps/${app}/next.config.ts`);
      const host = canonicalHostname(app).replaceAll(".", String.raw`\.`);
      expect(config).toMatch(new RegExp(String.raw`"${host}",\s+"\*\.${host}"`, "v"));
    },
  );

  it("points CI's WEB_APP_URL at the web app's loopback URL", async () => {
    const workflow = await repoFile(".github/workflows/e2e.yml");
    expect(workflow).toContain(`WEB_APP_URL: ${loopbackUrl("web", "127.0.0.1")}\n`);
  });
});
