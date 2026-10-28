import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TemplateForm } from "./template-form";

const router: AppRouterInstance = {
  back: vi.fn<() => void>(),
  bfcacheId: "template-test",
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<() => void>(),
  push: vi.fn<() => void>(),
  refresh: vi.fn<() => void>(),
  replace: vi.fn<() => void>(),
};

const listItems = (_url: string, _init?: RequestInit) =>
  Promise.resolve(Response.json({ items: [] }));

const fetchMock = vi.fn(listItems);

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppRouterContext value={router}>
        <TemplateForm />
      </AppRouterContext>
    </QueryClientProvider>,
  );

const saves = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation(listItems);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TemplateForm", () => {
  it("validates on submit, then on every change, focusing the first invalid field", async () => {
    renderForm();
    const displayName = screen.getByLabelText("Nome de exibição");
    const submit = screen.getByRole("button", { name: "Criar modelo" });
    fireEvent.change(displayName, { target: { value: " " } });
    expect(screen.queryByText("Informe o nome de exibição.")).not.toBeInTheDocument();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    expect(screen.getByText("Informe o nome de exibição.")).toBeInTheDocument();
    expect(screen.getByText("Informe uma descrição.")).toBeInTheDocument();
    expect(displayName).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => {
      expect(displayName).toHaveFocus();
    });

    fireEvent.change(displayName, { target: { value: "  " } });
    expect(screen.getByText("Informe o nome de exibição.")).toBeInTheDocument();

    fireEvent.change(displayName, { target: { value: "Pesquisador de SEO" } });
    expect(screen.queryByText("Informe o nome de exibição.")).not.toBeInTheDocument();
    expect(screen.getByText("Informe uma descrição.")).toBeInTheDocument();
    expect(saves()).toHaveLength(0);
  });

  it("lists the allowed action types from the start", () => {
    renderForm();

    expect(screen.getByLabelText("Tipo de ação padrão")).toHaveAccessibleDescription(
      "Um destes: publish_post, worker_deliverable.",
    );
  });

  it("reports a failed save in the form alert and clears it on the next change", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Nome de exibição"), {
      target: { value: "Pesquisador de SEO" },
    });
    fireEvent.change(screen.getByLabelText("Tipo (worker kind)"), {
      target: { value: "seo-researcher" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Pesquisa SEO" } });
    fireEvent.change(screen.getByLabelText("Prompt do sistema"), {
      target: { value: "Você pesquisa SEO." },
    });
    fireEvent.change(screen.getByLabelText("Modelo (LLM)"), {
      target: { value: "openai/gpt-6.1-sol" },
    });
    fetchMock.mockImplementation((url, init) =>
      init?.method === "POST"
        ? Promise.resolve(new Response("boom", { status: 500 }))
        : listItems(url, init),
    );

    fireEvent.click(screen.getByRole("button", { name: "Criar modelo" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(saves()).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Pesquisa de SEO" } });
    expect(alert).not.toBeInTheDocument();
  });
});
