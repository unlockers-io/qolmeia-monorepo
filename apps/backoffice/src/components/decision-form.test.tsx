import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DecisionForm } from "./decision-form";

const router: AppRouterInstance = {
  back: vi.fn<() => void>(),
  bfcacheId: "decision-test",
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<() => void>(),
  push: vi.fn<() => void>(),
  refresh: vi.fn<() => void>(),
  replace: vi.fn<() => void>(),
};

const fetchMock = vi.fn(() => Promise.resolve(Response.json({ items: [] })));

const renderForm = () =>
  render(
    <AppRouterContext value={router}>
      <DecisionForm actionId="action-1" allowChanges defaultDecision={null} />
    </AppRouterContext>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DecisionForm", () => {
  it("asks for a decision on submit instead of disabling the button", async () => {
    renderForm();
    const submit = screen.getByRole("button", { name: "Escolha uma decisão" });
    const group = screen.getByRole("radiogroup", { name: "Decisão" });
    const approve = screen.getByRole("radio", { name: /Aprovar/v });
    expect(submit).toBeEnabled();
    expect(screen.queryByText("Escolha uma decisão.")).not.toBeInTheDocument();
    expect(group).toHaveAttribute("aria-invalid", "false");
    expect(approve).not.toHaveAttribute("aria-invalid");

    fireEvent.click(submit);

    expect(screen.getByText("Escolha uma decisão.")).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Escolha uma decisão.");
    await waitFor(() => {
      expect(approve).toHaveFocus();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Rejeitar/v }));
    expect(screen.queryByText("Escolha uma decisão.")).not.toBeInTheDocument();
    expect(group).toHaveAttribute("aria-invalid", "false");
  });

  it("keeps the feedback error until the feedback is no longer blank", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /Rejeitar/v }));
    const feedback = screen.getByRole("textbox", { name: /Observações/v });
    const error = /Escreva o motivo/v;
    expect(screen.queryByText(error)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar ação" }));

    expect(screen.getByText(error)).toBeInTheDocument();
    await waitFor(() => {
      expect(feedback).toHaveFocus();
    });

    fireEvent.change(feedback, { target: { value: "   " } });
    expect(screen.getByText(error)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Pedir ajustes/v }));
    expect(screen.getByText(error)).toBeInTheDocument();

    fireEvent.change(feedback, { target: { value: "Fora do tom da marca" } });
    expect(screen.queryByText(error)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pedir ajustes" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it("refuses feedback over the limit on submit instead of truncating it", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /Rejeitar/v }));
    const feedback = screen.getByRole("textbox", { name: /Observações/v });
    fireEvent.change(feedback, { target: { value: "a".repeat(2001) } });
    expect(feedback).toHaveValue("a".repeat(2001));

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar ação" }));

    expect(screen.getByText("Use no máximo 2000 caracteres.")).toBeInTheDocument();
    await waitFor(() => {
      expect(feedback).toHaveFocus();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(feedback, { target: { value: "a".repeat(2000) } });
    expect(screen.queryByText("Use no máximo 2000 caracteres.")).not.toBeInTheDocument();
  });

  it("reports a failed send in the form alert and clears it on the next change", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /Aprovar/v }));

    fireEvent.click(screen.getByRole("button", { name: "Aprovar e executar" }));

    const alert = await screen.findByText("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(alert).toHaveAttribute("data-slot", "form-alert");
    expect(screen.getByRole("button", { name: "Aprovar e executar" })).toBeEnabled();

    fireEvent.change(screen.getByRole("textbox", { name: /Observações/v }), {
      target: { value: "Tudo certo" },
    });
    expect(alert).not.toBeInTheDocument();
  });
});
