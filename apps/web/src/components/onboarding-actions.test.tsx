import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingActions } from "./onboarding-actions";

const templates = [
  { description: "Cria posts.", displayName: "Designer", id: "designer", workerKind: "designer" },
  { description: "Escreve textos.", displayName: "Redator", id: "writer", workerKind: "writer" },
];

beforeEach(() => {
  vi.spyOn(toast, "error");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OnboardingActions", () => {
  it("asks for a specialist on submit instead of disabling the button", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<OnboardingActions companyId="company-1" templates={templates} />);
    const designer = screen.getByRole("checkbox", { name: "Designer" });
    const writer = screen.getByRole("checkbox", { name: "Redator" });
    const confirm = screen.getByRole("button", { name: "Confirmar Time" });
    const error = "Escolha pelo menos um especialista.";

    fireEvent.click(designer);
    fireEvent.click(writer);
    expect(confirm).toBeEnabled();
    expect(screen.queryByText(error)).not.toBeInTheDocument();

    fireEvent.click(confirm);

    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(designer).toHaveAttribute("aria-invalid", "true");
    expect(designer).toHaveAccessibleDescription(error);
    await waitFor(() => {
      expect(designer).toHaveFocus();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();

    fireEvent.click(writer);
    await waitFor(() => {
      expect(screen.queryByText(error)).not.toBeInTheDocument();
    });
    expect(designer).toHaveAttribute("aria-invalid", "false");
  });

  it("reports a failed confirmation in the form alert and clears it on the next change", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));
    render(<OnboardingActions companyId="company-1" templates={templates} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar Time" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "form-alert");
    expect(alert).toHaveTextContent("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/teams/company-1/confirm",
      expect.objectContaining({ body: JSON.stringify({ templateIds: ["designer", "writer"] }) }),
    );
    expect(toast.error).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Redator" }));
    expect(alert).not.toBeInTheDocument();
  });
});
