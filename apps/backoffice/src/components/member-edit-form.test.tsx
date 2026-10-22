import type { TeamMemberDetailView } from "@repo/worker-api/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemberEditForm } from "./member-edit-form";

const base = {
  capabilities: "",
  companyName: "Padaria",
  createdAt: 0,
  currentWork: [],
  displayName: "Agente",
  hasPromptOverride: false,
  id: "agent",
  lifetimeDone: 0,
  promptOverride: null,
  promptOverrideUpdatedAt: null,
  status: "available",
  templateSystemPrompt: "Padrão",
} as const;

describe("member prompt capability", () => {
  it.each(["planner", "correspondent"] as const)(
    "does not offer a prompt editor for %s",
    (role) => {
      const member: TeamMemberDetailView = {
        ...base,
        currentWork: [],
        role,
        templateId: null,
        templateName: null,
        workerKind: null,
      };

      render(<MemberEditForm companyId="company" initialMember={member} memberId="agent" />);
      expect(screen.queryByRole("region", { name: "Prompt do agente" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Nome de exibição")).toBeInTheDocument();
    },
  );

  it("offers the editor for workers", () => {
    const member: TeamMemberDetailView = {
      ...base,
      currentWork: [],
      role: "worker",
      templateId: "tpl",
      templateName: "Designer",
      workerKind: "designer",
    };

    render(<MemberEditForm companyId="company" initialMember={member} memberId="agent" />);
    expect(screen.getByRole("region", { name: "Prompt do agente" })).toBeInTheDocument();
  });
});

const worker: TeamMemberDetailView = {
  ...base,
  currentWork: [],
  role: "worker",
  templateId: "tpl",
  templateName: "Designer",
  workerKind: "designer",
};

const renderWorker = () =>
  render(<MemberEditForm companyId="company" initialMember={worker} memberId="agent" />);

describe("member rename", () => {
  beforeEach(() => {
    vi.spyOn(toast, "error");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps rename disabled while the name is empty or unchanged", () => {
    renderWorker();
    const name = screen.getByLabelText("Nome de exibição");
    const rename = screen.getByRole("button", { name: "Renomear" });
    expect(name).toHaveAccessibleDescription("Até 80 caracteres.");
    expect(rename).toBeDisabled();

    fireEvent.change(name, { target: { value: "   " } });
    expect(rename).toBeDisabled();

    fireEvent.change(name, { target: { value: "Lia" } });
    expect(rename).toBeEnabled();
  });

  it("refuses a name over the limit on submit and clears the error once it fits", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWorker();
    const name = screen.getByLabelText("Nome de exibição");
    const error = "Use no máximo 80 caracteres.";
    fireEvent.change(name, { target: { value: "a".repeat(81) } });
    expect(screen.queryByText(error)).not.toBeInTheDocument();

    fireEvent.submit(name);

    expect(await screen.findByText(error)).toBeInTheDocument();
    await waitFor(() => {
      expect(name).toHaveFocus();
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "a".repeat(80) } });
    await waitFor(() => {
      expect(screen.queryByText(error)).not.toBeInTheDocument();
    });
  });

  it("reports a failed rename in the form alert and clears it on the next change", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("boom", { status: 500 }));
    renderWorker();
    const name = screen.getByLabelText("Nome de exibição");
    fireEvent.change(name, { target: { value: "Lia" } });

    fireEvent.submit(name);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "form-alert");
    expect(alert).toHaveTextContent("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(name).toHaveValue("Lia");

    fireEvent.change(name, { target: { value: "Lia B." } });
    expect(alert).not.toBeInTheDocument();
  });
});

describe("member prompt editor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps save disabled while the prompt is empty or unchanged", () => {
    render(
      <MemberEditForm
        companyId="company"
        initialMember={{ ...worker, promptOverride: "Seja breve." }}
        memberId="agent"
      />,
    );
    const prompt = screen.getByRole("textbox", { name: "Prompt do agente" });
    const save = screen.getByRole("button", { name: "Salvar prompt" });
    expect(save).toBeDisabled();

    fireEvent.change(prompt, { target: { value: "" } });
    expect(save).toBeDisabled();

    fireEvent.change(prompt, { target: { value: "Seja breve e direto." } });
    expect(save).toBeEnabled();
  });

  it("refuses a prompt over the limit on submit with focus on the prompt", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWorker();
    const prompt = screen.getByRole("textbox", { name: "Prompt do agente" });
    expect(prompt).toHaveAccessibleDescription(/Até 20\.000 caracteres\./v);
    fireEvent.change(prompt, { target: { value: "a".repeat(20_001) } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar prompt" }));

    expect(await screen.findByText("Use no máximo 20.000 caracteres.")).toBeInTheDocument();
    await waitFor(() => {
      expect(prompt).toHaveFocus();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports a failed save in the form alert", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("boom", { status: 500 }));
    renderWorker();
    fireEvent.change(screen.getByRole("textbox", { name: "Prompt do agente" }), {
      target: { value: "Seja breve." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar prompt" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Algo falhou do nosso lado. Tente de novo em instantes.");
    expect(screen.getByRole("region", { name: "Prompt do agente" })).toContainElement(alert);
  });
});
