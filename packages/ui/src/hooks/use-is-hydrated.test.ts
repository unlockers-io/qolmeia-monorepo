import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useIsHydrated } from "./use-is-hydrated";

describe("useIsHydrated", () => {
  it("should return false while hydrating server markup", () => {
    const renders: Array<boolean> = [];

    renderHook(
      () => {
        renders.push(useIsHydrated());
      },
      { hydrate: true },
    );

    expect(renders[0]).toBe(false);
  });

  it("should return true once hydrated", () => {
    const { result } = renderHook(() => useIsHydrated(), { hydrate: true });

    expect(result.current).toBe(true);
  });
});
