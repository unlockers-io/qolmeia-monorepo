import { ApiError } from "@repo/worker-api";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PromptEditor } from "./prompt-editor";

const renderEditor = ({
  initialValue = null,
  onReset = vi.fn<() => Promise<void>>().mockResolvedValue(),
  onSave = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(),
}: {
  initialValue?: string | null;
  onReset?: () => Promise<void>;
  onSave?: (value: string) => Promise<void>;
} = {}) => {
  render(
    <PromptEditor initialValue={initialValue} onReset={onReset} onSave={onSave} updatedAt={null} />,
  );

  return {
    prompt: screen.getByLabelText("Instruções para este agente"),
    save: screen.getByRole("button", { name: "Salvar" }),
  };
};

describe("PromptEditor", () => {
  it("keeps save disabled while the prompt is empty or unchanged", () => {
    const { prompt, save } = renderEditor({ initialValue: "Seja breve." });
    expect(save).toBeDisabled();

    fireEvent.change(prompt, { target: { value: "Seja breve.  " } });
    expect(save).toBeDisabled();

    fireEvent.change(prompt, { target: { value: "   " } });
    expect(save).toBeDisabled();

    fireEvent.change(prompt, { target: { value: "Seja breve e direto." } });
    expect(save).toBeEnabled();
  });

  it("refuses a prompt over the limit on submit and clears the error once it fits", async () => {
    const onSave = vi.fn<(value: string) => Promise<void>>().mockResolvedValue();
    const { prompt, save } = renderEditor({ onSave });
    const error = "Use no máximo 20.000 caracteres.";
    expect(prompt).toHaveAccessibleDescription(/Até 20\.000 caracteres\./v);

    fireEvent.change(prompt, { target: { value: "a".repeat(20_001) } });
    expect(screen.queryByText(error)).not.toBeInTheDocument();
    fireEvent.click(save);

    expect(await screen.findByText(error)).toBeInTheDocument();
    await waitFor(() => {
      expect(prompt).toHaveFocus();
    });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(prompt, { target: { value: "a".repeat(20_000) } });
    await waitFor(() => {
      expect(screen.queryByText(error)).not.toBeInTheDocument();
    });
  });

  it("reports a failed save in the form alert and clears it on the next change", async () => {
    const onSave = vi
      .fn<(value: string) => Promise<void>>()
      .mockRejectedValue(new ApiError(500, "boom"));

    const { prompt, save } = renderEditor({ onSave });
    fireEvent.change(prompt, { target: { value: "Seja breve." } });

    fireEvent.click(save);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "form-alert");
    expect(alert).toHaveTextContent("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(onSave).toHaveBeenCalledWith("Seja breve.");

    fireEvent.change(prompt, { target: { value: "Seja breve e direto." } });
    expect(alert).not.toBeInTheDocument();
  });

  it("reports a failed reset in the form alert", async () => {
    const onReset = vi.fn<() => Promise<void>>().mockRejectedValue(new TypeError("offline"));
    renderEditor({ initialValue: "Seja breve.", onReset });

    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conectar. Verifique sua internet e tente de novo.",
    );
    expect(screen.getByLabelText("Instruções para este agente")).toHaveValue("Seja breve.");
  });
});
