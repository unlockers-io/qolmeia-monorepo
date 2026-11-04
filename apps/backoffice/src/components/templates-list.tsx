"use client";

import { Button, buttonVariants } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { StatusPill, type StatusTone } from "@repo/ui/compositions/status-pill";
import { cn } from "@repo/ui/lib/utils";
import type { Template, TemplateStatus } from "@repo/worker-api/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Skeleton } from "skullet/react";
import { toast } from "sonner";

import { describeRequestError } from "@/lib/api-client";
import { fetchTemplates, setTemplateStatus, templateKeys } from "@/lib/templates-api";

type StatusLabelContract = Record<TemplateStatus, { label: string; tone: StatusTone }>;

const STATUS_LABEL = {
  active: { label: "Ativo", tone: "success" },
  retired: { label: "Desativado", tone: "neutral" },
} satisfies StatusLabelContract;

type TemplateListItem = Pick<
  Template,
  "displayName" | "id" | "model" | "skillIds" | "status" | "workerKind"
>;

const SAMPLE_TEMPLATES: ReadonlyArray<TemplateListItem> = [
  {
    displayName: "Designer",
    id: "sample-designer",
    model: "openai/gpt-6-luna",
    skillIds: ["sample-1", "sample-2", "sample-3"],
    status: "active",
    workerKind: "designer",
  },
  {
    displayName: "Estrategista de marketing",
    id: "sample-strategist",
    model: "openai/gpt-6.1-sol",
    skillIds: ["sample-1", "sample-2"],
    status: "active",
    workerKind: "marketing-strategist",
  },
  {
    displayName: "Redator",
    id: "sample-redator",
    model: "openai/gpt-6.1-sol",
    skillIds: ["sample-1", "sample-2"],
    status: "retired",
    workerKind: "redator",
  },
];

type TemplateRowProps = {
  busy: boolean;
  onToggle: (template: TemplateListItem) => void;
  template: TemplateListItem;
};

const TemplateRow = ({ busy, onToggle, template }: TemplateRowProps) => {
  const status = STATUS_LABEL[template.status];
  const toggleLabel = template.status === "retired" ? "Reativar" : "Desativar";

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
        <StatusPill label={status.label} tone={status.tone} />
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
  busy: boolean;
  onToggle: (template: TemplateListItem) => void;
  templates: ReadonlyArray<TemplateListItem>;
};

const TemplatesTableBody = ({ busy, onToggle, templates }: TemplatesTableBodyProps) => {
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
            <TemplateRow busy={busy} key={template.id} onToggle={onToggle} template={template} />
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

const TemplatesCard = ({ busy, isError, onToggle, templates }: TemplatesCardProps) => (
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
      {(rows) => <TemplatesTableBody busy={busy} onToggle={onToggle} templates={rows} />}
    </Skeleton>
  </Card>
);

const TemplatesListSkeleton = () => (
  <TemplatesCard busy isError={false} onToggle={() => undefined} templates={null} />
);

type StatusPatch = { id: string; status: TemplateStatus };

const applyStatus = (
  templates: ReadonlyArray<Template>,
  patch: StatusPatch,
): ReadonlyArray<Template> =>
  templates.map((template) =>
    template.id === patch.id ? { ...template, status: patch.status } : template,
  );

const TemplatesList = () => {
  const queryClient = useQueryClient();

  const { data, isError } = useQuery({
    queryFn: fetchTemplates,
    queryKey: templateKeys.all,
  });

  const [isToggling, startToggle] = useTransition();
  const [templates, applyOptimisticStatus] = useOptimistic(data?.items ?? [], applyStatus);

  const handleToggle = (template: TemplateListItem) => {
    const status: TemplateStatus = template.status === "retired" ? "active" : "retired";
    startToggle(async () => {
      applyOptimisticStatus({ id: template.id, status });

      try {
        await setTemplateStatus(template.id, status);
        await queryClient.invalidateQueries({ queryKey: templateKeys.all });
        toast.success(status === "retired" ? "Modelo desativado." : "Modelo reativado.");
      } catch (error) {
        toast.error(describeRequestError(error, "Não foi possível alterar o status."));
      }
    });
  };

  return (
    <TemplatesCard
      busy={isToggling}
      isError={isError}
      onToggle={handleToggle}
      templates={data ? templates : null}
    />
  );
};

export { TemplatesList, TemplatesListSkeleton };
