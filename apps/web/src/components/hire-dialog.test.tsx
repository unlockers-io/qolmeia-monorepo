import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HireDialog } from "./hire-dialog";

const template = {
  description: "Cria posts.",
  displayName: "Designer",
  hiredCount: 0,
  id: "tpl-designer",
  workerKind: "designer",
};

const onClose = vi.fn<() => void>();
const onHired = vi.fn<() => void>();

const renderDialog = () =>
  render(<HireDialog onClose={onClose} onHired={onHired} open template={template} />);

beforeEach(() => {
  vi.spyOn(toast, "error");
});

afterEach(() => {
  vi.restoreAllMocks();
  onClose.mockReset();
  onHired.mockReset();
});

describe("HireDialog", () => {
  it("explains the name limit from the start and refuses a longer name on submit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderDialog();
    const name = screen.getByLabelText("Nome (opcional)");
    const error = "Use no máximo 80 caracteres.";
    expect(name).toHaveAccessibleDescription("Até 80 caracteres.");

    fireEvent.change(name, { target: { value: "a".repeat(81) } });
    expect(screen.queryByText(error)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contratar" }));

    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => {
      expect(name).toHaveFocus();
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "a".repeat(80) } });
    await waitFor(() => {
      expect(screen.queryByText(error)).not.toBeInTheDocument();
    });
  });

  it("hires on Enter with the typed name", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ member: { displayName: "Lia" } }));

    renderDialog();
    const name = screen.getByLabelText("Nome (opcional)");
    fireEvent.change(name, { target: { value: " Lia " } });

    fireEvent.submit(name);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(onHired).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/me/team/hire",
      expect.objectContaining({
        body: JSON.stringify({ displayName: "Lia", templateId: "tpl-designer" }),
      }),
    );
  });

  it("reports a failed hire in the form alert and clears it on the next change", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("boom", { status: 500 }));
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Contratar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "form-alert");
    expect(alert).toHaveTextContent("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Contratar" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Nome (opcional)"), { target: { value: "Lia" } });
    expect(alert).not.toBeInTheDocument();
  });
});
