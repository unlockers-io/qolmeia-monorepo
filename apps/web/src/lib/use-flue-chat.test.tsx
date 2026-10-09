import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createUseFlueChat } from "./use-flue-chat";

const hookSendMessage = vi.fn();
let capturedUrl: string | undefined;
const useFlueChat = createUseFlueChat((url) => {
  capturedUrl = url;
  return {
    error: undefined,
    historyReady: true,
    messages: [],
    sendMessage: hookSendMessage,
    status: "idle",
  };
});

describe("useFlueChat", () => {
  it("sends customer messages through the React conversation hook", async () => {
    hookSendMessage.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useFlueChat({
        agent: "planner",
        companyId: "co_test",
      }),
    );

    await act(async () => {
      await result.current.sendMessage({ files: [], text: "  Olá  " });
    });

    expect(hookSendMessage).toHaveBeenCalledWith("Olá", { images: [] });
  });

  it("addresses the conversation by agent mount plus company id", () => {
    renderHook(() =>
      useFlueChat({
        agent: "correspondent",
        companyId: "co_test",
      }),
    );

    expect(capturedUrl).toBe("/agents/correspondent/co_test");
  });
});
