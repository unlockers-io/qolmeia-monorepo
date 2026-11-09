import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarView as Sidebar, type SidebarDependencies } from "./sidebar";

const dependencies: SidebarDependencies = {
  pathname: "/approvals",
  SignOutControl: ({ className }) => (
    <button className={className} type="button">
      Sair
    </button>
  ),
};

const user = { email: "operator@qolmeia.dev", name: "Operadora", role: "OWNER" } as const;

const renderSidebar = () =>
  render(<Sidebar dependencies={dependencies} pendingCount={0} user={user} />);

describe("Sidebar", () => {
  it("renders every nav link in pt-BR", () => {
    renderSidebar();
    expect(screen.getAllByRole("link", { name: /Início/v })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Aprovações/v })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Tickets/v })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Modelos/v })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Atividade/v })).toHaveLength(2);
  });

  it("marks the active route with aria-current", () => {
    renderSidebar();
    const activeLinks = screen.getAllByRole("link", { name: /Aprovações/v });
    expect(activeLinks).toHaveLength(2);
    expect(activeLinks.every((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  });

  it("renders the sign-out control in the footer", () => {
    renderSidebar();
    expect(screen.getAllByRole("button", { name: "Sair" })).toHaveLength(2);
  });
});
