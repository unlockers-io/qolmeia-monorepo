import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginFormView as LoginForm, type LoginFormDependencies } from "./login-form";

const renderLoginForm = () => {
  const push = vi.fn();
  const refresh = vi.fn();
  const sendMagicLink = vi.fn(() => Promise.resolve({ error: null }));
  const showError = vi.fn();
  const signInEmail = vi.fn(() => Promise.resolve({ error: null }));
  const dependencies: LoginFormDependencies = {
    router: {
      push: (href) => {
        push(href);
      },
      refresh: () => {
        refresh();
      },
    },
    sendMagicLink,
    showError: (message) => {
      showError(message);
    },
    signInEmail,
  };

  render(<LoginForm dependencies={dependencies} />);

  return { push, refresh, sendMagicLink, showError, signInEmail };
};

describe("LoginForm", () => {
  it.each(["password", "magicLink"])("cancels native navigation for %s submission", (method) => {
    renderLoginForm();
    if (method === "magicLink") {
      fireEvent.click(screen.getByRole("button", { name: "Entrar com link mágico" }));
    }
    const label = method === "magicLink" ? "Enviar link mágico" : "Entrar";
    const form = screen.getByRole("button", { name: label }).closest("form");
    if (form === null) {
      throw new Error("The login submit button must belong to its form");
    }
    const event = createEvent.submit(form);
    fireEvent(form, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("defaults to e-mail and password login", () => {
    renderLoginForm();
    expect(screen.getByLabelText(/E-mail/v)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/v)).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar com link mágico" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar link mágico" })).not.toBeInTheDocument();
  });

  it("signs in with e-mail and password", async () => {
    const { push, refresh, signInEmail } = renderLoginForm();

    fireEvent.change(screen.getByLabelText(/E-mail/v), {
      target: { value: "pedro+customer@filho.me" },
    });
    fireEvent.change(screen.getByLabelText(/Senha/v), {
      target: { value: "Senha123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: "pedro+customer@filho.me",
        password: "Senha123!",
      });
    });
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps magic-link login available", async () => {
    const { sendMagicLink } = renderLoginForm();

    fireEvent.change(screen.getByLabelText(/E-mail/v), {
      target: { value: "pedro+customer@filho.me" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar com link mágico" }));

    expect(screen.queryByLabelText(/Senha/v)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/v)).toHaveValue("pedro+customer@filho.me");
    expect(screen.getByRole("button", { name: "Entrar com senha" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar link mágico" }));

    await waitFor(() => {
      expect(sendMagicLink).toHaveBeenCalledWith({
        callbackURL: "http://localhost:3000/auth/verify",
        email: "pedro+customer@filho.me",
      });
    });
    expect(screen.getByRole("heading", { name: "Verifique seu e-mail" })).toBeInTheDocument();
  });
});
