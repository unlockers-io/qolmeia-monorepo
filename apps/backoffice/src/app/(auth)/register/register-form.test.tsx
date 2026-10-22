import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./register-form";

const router: AppRouterInstance = {
  back: vi.fn<() => void>(),
  bfcacheId: "register-test",
  forward: vi.fn<() => void>(),
  prefetch: vi.fn<() => void>(),
  push: vi.fn<() => void>(),
  refresh: vi.fn<() => void>(),
  replace: vi.fn<() => void>(),
};
const fetchMock = vi.fn(() => Promise.resolve(Response.json({})));

const renderForm = async () => {
  const searchParams = Promise.resolve({});
  await act(async () => {
    render(
      <AppRouterContext value={router}>
        <RegisterForm searchParams={searchParams} />
      </AppRouterContext>,
    );
    await searchParams;
  });
};

const fill = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RegisterForm", () => {
  it("explains the name and password rules before any submit", async () => {
    await renderForm();

    expect(screen.getByLabelText("Nome")).toHaveAccessibleDescription("De 3 a 32 caracteres.");
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("Pelo menos 12 caracteres.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports mismatched passwords on the confirmation field and focuses it", async () => {
    await renderForm();
    fill("Nome", "Pedro");
    fill("E-mail", "voce@empresa.com");
    fill("Senha", "SenhaSegura123!");
    fill("Confirmar senha", "SenhaDiferente1!");

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    const confirm = screen.getByLabelText("Confirmar senha");
    expect(await screen.findByText("As senhas não conferem.")).toBeInTheDocument();
    await waitFor(() => {
      expect(confirm).toHaveFocus();
    });

    fill("Confirmar senha", "SenhaSegura123!");
    await waitFor(() => {
      expect(screen.queryByText("As senhas não conferem.")).not.toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the exact length error under the password after submit", async () => {
    await renderForm();
    fill("Nome", "Pedro");
    fill("E-mail", "voce@empresa.com");
    fill("Senha", "curta");

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    const password = screen.getByLabelText("Senha");
    await waitFor(() => {
      expect(password).toHaveAccessibleDescription(
        "Pelo menos 12 caracteres. A senha deve ter pelo menos 12 caracteres",
      );
    });
    await waitFor(() => {
      expect(password).toHaveFocus();
    });
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });
});
