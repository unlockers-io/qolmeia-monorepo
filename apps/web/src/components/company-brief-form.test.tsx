import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyBriefForm } from "./company-brief-form";

const fetchMock = vi.fn(() => Promise.resolve(new Response("boom", { status: 500 })));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CompanyBriefForm
        companyId="company-1"
        initialData={{
          company: { brief: {}, id: "company-1", slug: "empresa", status: "active" },
          completeness: { filled: [], isComplete: false, missing: [], percent: 0 },
        }}
      />
    </QueryClientProvider>,
  );

describe("CompanyBriefForm", () => {
  it("explains each field's limit from the start", () => {
    renderForm();

    expect(screen.getByLabelText(/Setor/v)).toHaveAccessibleDescription("Até 200 caracteres.");
    expect(screen.getByLabelText(/Objetivo principal/v)).toHaveAccessibleDescription(
      "Até 500 caracteres.",
    );
    expect(screen.getByLabelText(/Público-alvo/v)).toHaveAccessibleDescription(
      "Até 500 caracteres.",
    );
    expect(screen.getByLabelText(/Tom da marca/v)).toHaveAccessibleDescription(
      "Até 200 caracteres.",
    );
    expect(screen.getByLabelText(/Cores da marca/v)).toHaveAccessibleDescription(
      "Até 200 caracteres.",
    );
    expect(screen.getByLabelText(/Referências de marca/v)).toHaveAccessibleDescription(
      "Até 500 caracteres.",
    );
  });

  it("refuses text over the limit on submit, focuses the first field over it, and clears on fix", async () => {
    renderForm();
    const voice = screen.getByLabelText(/Tom da marca/v);
    const references = screen.getByLabelText(/Referências de marca/v);
    fireEvent.change(voice, { target: { value: "a".repeat(201) } });
    fireEvent.change(references, { target: { value: "a".repeat(501) } });
    expect(screen.queryByText("Use no máximo 200 caracteres.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Use no máximo 200 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Use no máximo 500 caracteres.")).toBeInTheDocument();
    expect(voice).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => {
      expect(voice).toHaveFocus();
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/me/company",
      expect.objectContaining({ method: "PATCH" }),
    );

    fireEvent.change(voice, { target: { value: `  ${"a".repeat(200)}  ` } });
    await waitFor(() => {
      expect(screen.queryByText("Use no máximo 200 caracteres.")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Use no máximo 500 caracteres.")).toBeInTheDocument();
  });

  it("reports a failed save in the form alert and clears it on the next change", async () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível salvar. Tente novamente.");

    fireEvent.change(screen.getByLabelText(/Setor/v), { target: { value: "Alimentação" } });
    expect(alert).not.toBeInTheDocument();
  });
});
