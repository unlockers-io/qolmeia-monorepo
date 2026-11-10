import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplatesList, TemplatesListSkeleton } from "./templates-list";

const TEMPLATE = {
  displayName: "Pesquisador SEO",
  id: "tpl_seo",
  model: "openai/gpt-6.1-sol",
  skillIds: ["skill_1"],
  status: "active",
  workerKind: "seo-researcher",
};

const renderList = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <TemplatesList />
    </QueryClientProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TemplatesList", () => {
  it("announces loading and hides the sample rows from assistive tech", () => {
    render(<TemplatesListSkeleton />);

    expect(screen.getByText("Carregando modelos")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the loaded templates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ items: [TEMPLATE] }))),
    );
    renderList();

    expect(await screen.findByRole("link", { name: "Pesquisador SEO" })).toBeInTheDocument();
  });

  it("says so when the templates fail to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    );
    renderList();

    expect(await screen.findByText("Não foi possível carregar os modelos.")).toBeInTheDocument();
  });
});
