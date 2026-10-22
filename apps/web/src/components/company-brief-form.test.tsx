import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyBriefForm } from "./company-brief-form";

const fetchMock = vi.fn(() => Promise.resolve(new Response("boom", { status: 500 })));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CompanyBriefForm", () => {
  it("reports a failed save in the form alert and clears it on the next change", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível salvar. Tente novamente.");

    fireEvent.change(screen.getByLabelText(/Setor/v), { target: { value: "Alimentação" } });
    expect(alert).not.toBeInTheDocument();
  });
});
