import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFlueClient } from "./use-flue-client";

const url = "https://chat.example.com/agents/team/1";

describe("useFlueClient", () => {
  it("preserves live client identity across unrelated renders", () => {
    const { rerender, result } = renderHook(useFlueClient, { initialProps: url });
    const client = result.current;
    rerender(url);
    expect(result.current).toBe(client);
  });

  it("replaces the client when the company conversation changes", () => {
    const { rerender, result } = renderHook(useFlueClient, { initialProps: url });
    const original = result.current;
    const next = "https://chat.example.com/agents/team/2";
    rerender(next);
    expect(result.current).not.toBe(original);
    expect(result.current.url).toBe(next);
  });

  it("does not share clients between hook instances", () => {
    const first = renderHook(useFlueClient, { initialProps: url });
    const second = renderHook(useFlueClient, { initialProps: url });
    expect(first.result.current).not.toBe(second.result.current);
  });

  it("sends no Authorization header, so the session rides the httpOnly cookie", async () => {
    const requests: Array<Request> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      requests.push(new Request(input, init));
      return Promise.resolve(Response.json({ messages: [] }));
    };
    try {
      const { result } = renderHook(useFlueClient, { initialProps: url });
      await result.current.history().catch(() => null);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.headers.has("Authorization")).toBe(false);
      expect(request.credentials).toBe("include");
    }
  });
});
