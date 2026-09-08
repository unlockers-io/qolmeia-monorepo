import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFlueClient } from "./use-flue-client";

const options = { sessionToken: "first-session", url: "https://chat.example.com/agents/team/1" };

describe("useFlueClient", () => {
  it("preserves live client identity across unrelated renders", () => {
    const { rerender, result } = renderHook(useFlueClient, { initialProps: options });
    const client = result.current;
    rerender({ ...options });
    expect(result.current).toBe(client);
  });

  it("replaces the client when the authenticated session changes", () => {
    const { rerender, result } = renderHook(useFlueClient, { initialProps: options });
    const original = result.current;
    const next = { ...options, sessionToken: "second-session" };
    rerender(next);
    expect(result.current).not.toBe(original);
    const authenticated = result.current;
    rerender({ ...next });
    expect(result.current).toBe(authenticated);
  });

  it("replaces the client when the company conversation changes", () => {
    const { rerender, result } = renderHook(useFlueClient, { initialProps: options });
    const original = result.current;
    const next = { ...options, url: "https://chat.example.com/agents/team/2" };
    rerender(next);
    expect(result.current).not.toBe(original);
    expect(result.current.url).toBe(next.url);
  });

  it("does not share authenticated clients between hook instances", () => {
    const first = renderHook(useFlueClient, { initialProps: options });
    const second = renderHook(useFlueClient, { initialProps: options });
    expect(first.result.current).not.toBe(second.result.current);
  });
});
