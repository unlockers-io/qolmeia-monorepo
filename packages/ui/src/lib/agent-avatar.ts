type AgentRole = "correspondent" | "planner" | "worker";

const WORKER_KIND_AVATAR: ReadonlyArray<{ cls: string; match: RegExp }> = [
  { cls: "bg-avatar-2", match: /design|art|imagem/iv },
  { cls: "bg-avatar-3", match: /estrateg|strateg|plano/iv },
  { cls: "bg-avatar-4", match: /redat|copy|escrit|texto/iv },
  { cls: "bg-avatar-5", match: /social|m[ií]dia|community|seo|pesquis/iv },
];

const agentAvatarClass = (role: AgentRole, workerKind: string | null): string => {
  if (role === "correspondent") {
    return "bg-avatar-1";
  }
  if (role === "planner") {
    return "bg-avatar-6";
  }
  const hit = WORKER_KIND_AVATAR.find((w) => w.match.test(workerKind ?? ""));
  return hit?.cls ?? "bg-avatar-8";
};

const agentInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/v)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.at(0)?.toLocaleUpperCase("pt-BR") ?? "")
    .join("") || "?";

const agentRoleLabel = (role: AgentRole, templateName: string | null): string => {
  if (role === "correspondent") {
    return "Correspondente";
  }
  if (role === "planner") {
    return "Planejador";
  }
  return templateName ?? "Especialista";
};

export { agentAvatarClass, agentInitials, agentRoleLabel };
export type { AgentRole };
