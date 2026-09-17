import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { createLoginForm } from "./login-form";

const showError = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const LoginForm = createLoginForm({
  showError: (message) => {
    showError(message);
  },
  signInEmail: vi.fn(() => Promise.resolve({ error: null })),
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
