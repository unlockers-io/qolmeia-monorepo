import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NavView as Nav, type NavDependencies } from "./nav";

const dependencies: NavDependencies = {
  pathname: "/",
  SignOutControl: () => <button type="button">Sair</button>,
};

describe("Nav", () => {
  it("renders the supplied org name in the company slot", () => {
    render(<Nav dependencies={dependencies} orgName="Salão da Maria" />);
    expect(screen.getByText("Salão da Maria")).toBeInTheDocument();
  });

  it("links the logo home", () => {
    render(<Nav dependencies={dependencies} orgName="Salão" />);
    expect(screen.getByRole("link", { name: "Qolmeia" })).toHaveAttribute("href", "/");
  });

  it("marks the active route with aria-current=page", () => {
    render(<Nav dependencies={dependencies} orgName="Salão" />);
    expect(screen.getByRole("link", { name: /Chat/v })).toHaveAttribute("aria-current", "page");
  });
});
