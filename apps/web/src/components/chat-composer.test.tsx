import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatComposer } from "./chat-composer";

beforeEach(() => {
  vi.spyOn(toast, "error");
});
afterEach(() => {
  vi.restoreAllMocks();
});

const attach = async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    Response.json({
      assetId: "image-1",
      mime: "image/png",
      size: 4,
      url: "/assets/image-1",
    }),
  );
  fireEvent.change(screen.getByLabelText("Anexar imagem", { selector: "input" }), {
    target: { files: [new File(["logo"], "logo.png", { type: "image/png" })] },
  });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
  });
};

describe("chat submission acknowledgement", () => {
  it("retains text and attachments after failure and retries the same draft", async () => {
    const pending = Promise.withResolvers<undefined>();
    const onSend = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined);
    render(<ChatComposer disabled={false} onSend={onSend} status="ready" />);
    const message = screen.getByLabelText("Mensagem");
    fireEvent.change(message, { target: { value: "meu pedido" } });
    await attach();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(message).toHaveValue("meu pedido");
    expect(message).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remover logo.png" })).toBeDisabled();
    fireEvent.submit(message.closest("form") as HTMLFormElement);
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.reject(new Error("attachment fetch failed"));
      await Promise.resolve();
    });
    expect(message).toHaveValue("meu pedido");
    expect(message).toBeEnabled();
    expect(screen.getByText("logo.png")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => {
      expect(message).toHaveValue("");
    });
    expect(onSend.mock.calls[1]).toEqual(onSend.mock.calls[0]);
    expect(screen.queryByText("logo.png")).not.toBeInTheDocument();
  });

  it("blocks duplicate submissions until acceptance, then allows the next draft", async () => {
    const pending = Promise.withResolvers<undefined>();
    const onSend = vi.fn(() => pending.promise);
    render(<ChatComposer disabled={false} onSend={onSend} status="ready" />);
    const message = screen.getByLabelText("Mensagem");
    fireEvent.change(message, { target: { value: "pedido" } });
    const form = message.closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(message).toHaveValue("pedido");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    await act(async () => {
      pending.resolve(undefined);
      await pending.promise;
    });
    expect(message).toHaveValue("");
    fireEvent.change(message, { target: { value: "próximo pedido" } });
    expect(message).toHaveValue("próximo pedido");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
  });
});
