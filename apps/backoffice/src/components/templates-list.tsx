"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { StatusPill, type StatusTone } from "@repo/ui/compositions/status-pill";
import { cn } from "@repo/ui/lib/utils";
import { apiGet } from "@repo/worker-api";
import type { Template, TemplateStatus } from "@repo/worker-api/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Skeleton } from "skullet/react";

import { getTemplates, templateKeys } from "@/lib/backoffice-api";
import {
  NEXT_STATUS,
  TOGGLE_LABEL,
  useToggleTemplateStatus,
} from "@/lib/use-toggle-template-status";

const STATUS_LABEL = {
  active: { label: "Ativo", tone: "success" },
  retired: { label: "Desativado", tone: "neutral" },
} satisfies Record<TemplateStatus, { label: string; tone: StatusTone }>;

type TemplateListItem = Pick<
  Template,
  "displayName" | "id" | "model" | "skillIds" | "status" | "workerKind"
>;

const SAMPLE_TEMPLATES: ReadonlyArray<TemplateListItem> = [
  {
    displayName: "Designer",
    id: "sample-designer",
    model: "openai/gpt-6-luna",
    skillIds: ["generateBrandImage", "rememberFact", "recallMemory"],
    status: "active",
    workerKind: "designer",
  },
  {
    displayName: "Estrategista de marketing",
    id: "sample-strategist",
    model: "openai/gpt-6.1-sol",
    skillIds: ["webSearch", "fetchUrl"],
    status: "active",
    workerKind: "marketing-strategist",
  },
  {
    displayName: "Redator",
    id: "sample-redator",
    model: "openai/gpt-6.1-sol",
    skillIds: ["draftSocialPost", "recallMemory"],
    status: "retired",
    workerKind: "redator",
  },
];

type TemplateRowProps = {
  busy: boolean;
  onToggle: (template: TemplateListItem) => void;
  status: TemplateStatus;
  template: TemplateListItem;
};

const TemplateRow = ({ busy, onToggle, status, template }: TemplateRowProps) => {
  const pill = STATUS_LABEL[status];
  const toggleLabel = TOGGLE_LABEL[status];

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/40">
      <td className="px-5 py-3">
        <Link
          className="rounded-sm font-semibold text-foreground transition-colors outline-none hover:text-primary focus-visible:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/templates/${template.id}`}
        >
          {template.displayName}
        </Link>
      </td>
      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{template.workerKind}</td>
      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{template.model}</td>
      <td className="px-5 py-3 text-center text-muted-foreground tabular-nums">
        {template.skillIds.length}
      </td>
      <td className="px-5 py-3">
        <StatusPill label={pill.label} tone={pill.tone} />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            aria-label={`Editar ${template.displayName}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            href={`/templates/${template.id}`}
          >
            Editar
          </Link>
          <Button
            aria-label={`${toggleLabel} ${template.displayName}`}
            disabled={busy}
            onClick={() => {
              onToggle(template);
            }}
            size="sm"
            variant="ghost"
          >
            {toggleLabel}
          </Button>
        </div>
      </td>
    </tr>
  );
};

type TemplatesTableBodyProps = {
  onToggle: (template: TemplateListItem) => void;
  templates: ReadonlyArray<TemplateListItem>;
  toggling: Pick<TemplateListItem, "id" | "status"> | undefined;
};

const TemplatesTableBody = ({ onToggle, templates, toggling }: TemplatesTableBodyProps) => {
  if (templates.length === 0) {
    return (
      <EmptyState
        description="Crie o primeiro modelo de especialista para os times usarem."
        title="Nenhum modelo ainda"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Modelos de especialistas</caption>
        <thead>
          <tr className="border-b border-border text-left font-mono text-xs tracking-wide text-muted-foreground uppercase">
            <th className="px-5 py-3 font-medium">Nome</th>
            <th className="px-5 py-3 font-medium">Tipo</th>
            <th className="px-5 py-3 font-medium">Modelo</th>
            <th className="px-5 py-3 text-center font-medium">Habilidades</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <TemplateRow
              busy={toggling !== undefined}
              key={template.id}
              onToggle={onToggle}
              status={template.id === toggling?.id ? NEXT_STATUS[toggling.status] : template.status}
              template={template}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

type TemplatesCardProps = Omit<TemplatesTableBodyProps, "templates"> & {
  isError: boolean;
  templates: ReadonlyArray<TemplateListItem> | null;
};

const TemplatesCard = ({ isError, onToggle, templates, toggling }: TemplatesCardProps) => (
  <Card className="overflow-hidden p-0">
    <Skeleton
      data={templates}
      error={
        isError ? (
          <p className="px-5 py-8 text-center text-sm text-destructive">
            Não foi possível carregar os modelos.
          </p>
        ) : undefined
      }
      label="Carregando modelos"
      sample={SAMPLE_TEMPLATES}
    >
      {(rows) => <TemplatesTableBody onToggle={onToggle} templates={rows} toggling={toggling} />}
    </Skeleton>
  </Card>
);

const TemplatesListSkeleton = () => (
  <TemplatesCard isError={false} onToggle={() => undefined} templates={null} toggling={undefined} />
);

const TemplatesList = () => {
  const { data, isError } = useQuery({
    queryFn: () => getTemplates(apiGet),
    queryKey: templateKeys.all,
  });

  const toggle = useToggleTemplateStatus();

  return (
    <TemplatesCard
      isError={isError}
      onToggle={(template) => {
        toggle.mutate(template);
      }}
      templates={data?.items ?? null}
      toggling={toggle.isPending ? toggle.variables : undefined}
    />
  );
};

export { TemplatesList, TemplatesListSkeleton };
