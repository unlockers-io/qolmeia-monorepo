import type { ReportError } from "@repo/ui/hooks/use-error-report";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createSectionError } from "./section-error";

const failure = new Error("worker down");

const Failing = (): never => {
  throw failure;
};

describe("SectionError", () => {
  it("renders its children while they load", () => {
    const SectionError = createSectionError(vi.fn<ReportError>());

    render(
      <SectionError what="a atividade">
        <p>conteúdo</p>
      </SectionError>,
    );

    expect(screen.getByText("conteúdo")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("replaces a failed section with a reported, focused message and a retry", () => {
    const report = vi.fn<ReportError>();
    const SectionError = createSectionError(report);
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <p>resto da página</p>
        <SectionError framed what="a atividade">
          <Failing />
        </SectionError>
      </>,
    );

    const heading = screen.getByRole("heading", { name: "Dados indisponíveis" });
    expect(screen.getByText("Não foi possível carregar a atividade agora.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(screen.getByText("resto da página")).toBeTruthy();
    expect(document.activeElement).toBe(heading);
    expect(report).toHaveBeenCalledWith(failure);
  });
});
