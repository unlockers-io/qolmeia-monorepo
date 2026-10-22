import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { createLoginForm, type LoginDependencies } from "./login-form";

const push = vi.fn();
const refresh = vi.fn();
const signInEmail = vi.fn<LoginDependencies["signInEmail"]>(() => Promise.resolve({ error: null }));

const LoginForm = createLoginForm({
  signInEmail,
  useAppRouter: () => ({
    push: (path) => {
      push(path);
    },
    refresh: () => {
      refresh();
    },
  }),
});

describe("LoginForm", () => {
  it("renders the e-mail and password inputs", () => {
    render(<LoginForm searchParams={Promise.resolve({})} />);
    expect(screen.getByLabelText(/E-mail/v)).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("shows the primary CTA and the recover link", () => {
    render(<LoginForm searchParams={Promise.resolve({})} />);
    expect(screen.getByRole("button", { name: /Entrar/v })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute(
      "href",
      "/recover",
    );
    expect(screen.queryByRole("link", { name: "Criar conta" })).not.toBeInTheDocument();
  });

  it("validates on submit, then on every change, with submit enabled throughout", async () => {
    render(<LoginForm searchParams={Promise.resolve({})} />);
    const email = screen.getByLabelText(/E-mail/v);
    const submit = screen.getByRole("button", { name: "Entrar" });

    fireEvent.change(email, { target: { value: "voce@" } });
    fireEvent.blur(email);
    expect(screen.queryByText("E-mail inválido")).not.toBeInTheDocument();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => {
      expect(email).toHaveFocus();
    });
    expect(submit).toBeEnabled();

    fireEvent.change(email, { target: { value: "voce@empresa" } });
    expect(screen.getByText("E-mail inválido")).toBeInTheDocument();

    fireEvent.change(email, { target: { value: "voce@empresa.com" } });
    await waitFor(() => {
      expect(screen.queryByText("E-mail inválido")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Informe sua senha")).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("reports a failed sign-in in the form alert and clears it on the next change", async () => {
    signInEmail.mockResolvedValueOnce({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    render(<LoginForm searchParams={Promise.resolve({})} />);
    fireEvent.change(screen.getByLabelText(/E-mail/v), {
      target: { value: "voce@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos.");
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha2" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the unverified e-mail notice on the next change", async () => {
    signInEmail.mockResolvedValueOnce({ error: { code: "EMAIL_NOT_VERIFIED" } });
    render(<LoginForm searchParams={Promise.resolve({})} />);
    fireEvent.change(screen.getByLabelText(/E-mail/v), {
      target: { value: "voce@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const notice = await screen.findByText(/ainda não foi verificado/v);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha2" } });

    expect(notice).not.toBeInTheDocument();
  });

  it("renders the register prompt only when one is provided", () => {
    render(
      <LoginForm
        registerPrompt={<Link href="/register">Criar conta</Link>}
        searchParams={Promise.resolve({})}
      />,
    );
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/register");
  });
});
