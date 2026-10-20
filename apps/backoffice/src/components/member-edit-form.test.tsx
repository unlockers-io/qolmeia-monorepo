import type { TeamMemberDetailView } from "@repo/worker-api/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
