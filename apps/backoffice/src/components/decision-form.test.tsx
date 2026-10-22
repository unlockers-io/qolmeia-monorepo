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
  it("asks for a decision on submit instead of disabling the button", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: "Escolha uma decisão" });
    expect(submit).toBeEnabled();
    expect(screen.queryByText("Escolha uma decisão.")).not.toBeInTheDocument();

    fireEvent.click(submit);

    expect(screen.getByText("Escolha uma decisão.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Aprovar/v })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /Rejeitar/v }));
    expect(screen.queryByText("Escolha uma decisão.")).not.toBeInTheDocument();
  });

  it("keeps the feedback error until the feedback is no longer blank", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /Rejeitar/v }));
    const feedback = screen.getByRole("textbox", { name: /Observações/v });
    const error = /Escreva o motivo/v;
    expect(screen.queryByText(error)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar ação" }));

    expect(screen.getByText(error)).toBeInTheDocument();
    expect(feedback).toHaveFocus();

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
});
