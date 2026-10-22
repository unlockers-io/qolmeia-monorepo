import { describe, expect, it } from "vitest";

import { applyPortlessUrls, portlessUrl } from "./index";

const worktree = (prefix: string) => {
  const calls: Array<Array<string>> = [];

  const run = (file: string, args: ReadonlyArray<string>) => {
    calls.push([file, ...args]);

    return `https://${prefix}.${args.at(-1)}.localhost\n`;
  };

  return { calls, run };
};

const failing = () => {
  throw new Error("spawnSync portless ENOENT");
};

describe("portlessUrl", () => {
  it("asks portless for the app's worktree-prefixed URL", () => {
    const { calls, run } = worktree("fix-styles");
    expect(portlessUrl("web", { run })).toBe("https://fix-styles.qolmeia.web.localhost");
    expect(calls).toEqual([["portless", "get", "qolmeia.web"]]);
  });

  it("throws when portless cannot run", () => {
    expect(() => portlessUrl("web", { run: failing })).toThrow("spawnSync portless ENOENT");
  });

  it("throws when portless prints something other than a URL", () => {
    expect(() => portlessUrl("agents", { run: () => "no route\n" })).toThrow(
      'portless get qolmeia.agents printed "no route" instead of a URL',
    );
  });
});

describe("applyPortlessUrls", () => {
  it("does nothing outside a portless child", () => {
    for (const env of [{}, { PORTLESS_URL: "" }]) {
      const { calls, run } = worktree("fix-styles");
      applyPortlessUrls(["WEB_APP_URL"], { env, run });
      expect(env).not.toHaveProperty("WEB_APP_URL");
      expect(calls).toEqual([]);
    }
  });

  it("fills unset and empty keys from portless", () => {
    const { run } = worktree("fix-styles");
    const env = { PORTLESS_URL: "https://fix-styles.qolmeia.agents.localhost", WEB_APP_URL: "" };
    applyPortlessUrls(["CORS_ORIGINS", "WEB_APP_URL"], { env, run });
    expect(env).toMatchObject({
      CORS_ORIGINS:
        "https://fix-styles.qolmeia.web.localhost,https://fix-styles.qolmeia.backoffice.localhost",
      WEB_APP_URL: "https://fix-styles.qolmeia.web.localhost",
    });
  });

  it("replaces canonical local defaults on any scheme or port", () => {
    const { run } = worktree("fix-styles");

    const env = {
      CORS_ORIGINS: "https://qolmeia.web.localhost, http://qolmeia.backoffice.localhost:1355",
      NEXT_PUBLIC_WEB_APP_URL: "https://qolmeia.web.localhost",
      PORTLESS_URL: "https://fix-styles.qolmeia.backoffice.localhost",
    };

    applyPortlessUrls(["CORS_ORIGINS", "NEXT_PUBLIC_WEB_APP_URL"], { env, run });
    expect(env).toMatchObject({
      CORS_ORIGINS:
        "https://fix-styles.qolmeia.web.localhost,https://fix-styles.qolmeia.backoffice.localhost",
      NEXT_PUBLIC_WEB_APP_URL: "https://fix-styles.qolmeia.web.localhost",
    });
  });

  it("keeps values that are not the canonical default", () => {
    const explicit = {
      CORS_ORIGINS: "https://qolmeia.web.localhost",
      NEXT_PUBLIC_WEB_APP_URL: "https://other.qolmeia.web.localhost",
      WEB_APP_URL: "https://app.example.com",
    };

    const { calls, run } = worktree("fix-styles");
    const env = { ...explicit, PORTLESS_URL: "https://fix-styles.qolmeia.agents.localhost" };
    applyPortlessUrls(["CORS_ORIGINS", "NEXT_PUBLIC_WEB_APP_URL", "WEB_APP_URL"], { env, run });
    expect(env).toMatchObject(explicit);
    expect(calls).toEqual([]);
  });

  it("looks each app up once per call", () => {
    const { calls, run } = worktree("fix-styles");
    const env = { PORTLESS_URL: "https://fix-styles.qolmeia.agents.localhost" };
    applyPortlessUrls(["CORS_ORIGINS", "NEXT_PUBLIC_WEB_APP_URL", "WEB_APP_URL"], { env, run });
    expect(calls).toEqual([
      ["portless", "get", "qolmeia.web"],
      ["portless", "get", "qolmeia.backoffice"],
    ]);
  });

  it("throws instead of leaving a key half-filled when the lookup fails", () => {
    const env = { PORTLESS_URL: "https://qolmeia.agents.localhost" };
    expect(() => {
      applyPortlessUrls(["CORS_ORIGINS"], { env, run: failing });
    }).toThrow("spawnSync portless ENOENT");
    expect(env).not.toHaveProperty("CORS_ORIGINS");
  });
});
