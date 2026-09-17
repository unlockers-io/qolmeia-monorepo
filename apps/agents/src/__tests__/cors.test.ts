import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { FLUE_CLIENT_EXPOSED_HEADERS } from "#/app";

const ALLOWED_ORIGIN = "http://localhost:3001";

const exposedHeaders = (res: Response): Array<string> =>
  (res.headers.get("access-control-expose-headers") ?? "").split(",").map((h) => h.trim());

describe("worker CORS", () => {
  it("exposes the Flue stream and error headers to an allowed origin", async () => {
    const res = await exports.default.fetch("https://agents.test/healthz", {
      headers: { Origin: ALLOWED_ORIGIN },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(exposedHeaders(res)).toEqual(FLUE_CLIENT_EXPOSED_HEADERS);
    expect(exposedHeaders(res)).toContain("flue-error-ref");
  });

  it("answers the agent-route preflight before auth runs", async () => {
    const res = await exports.default.fetch("https://agents.test/agents/planner/co_cors", {
      headers: { "Access-Control-Request-Method": "GET", Origin: ALLOWED_ORIGIN },
      method: "OPTIONS",
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(exposedHeaders(res)).toEqual(FLUE_CLIENT_EXPOSED_HEADERS);
  });

  it("does not allow origins outside CLIENT_ORIGINS", async () => {
    const res = await exports.default.fetch("https://agents.test/healthz", {
      headers: { Origin: "https://evil.example" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
