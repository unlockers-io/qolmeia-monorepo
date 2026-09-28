import type { Template, TemplateInput } from "@repo/worker-api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/lib/api-client";
import {
  createTemplate,
  fetchSkillCatalog,
  setTemplateStatus,
  templateKeys,
  updateTemplate,
} from "@/lib/templates-api";

type FieldKey =
  | "defaultActionType"
  | "defaultPolicies"
  | "description"
  | "displayName"
  | "model"
  | "systemPrompt"
  | "workerKind";

const policiesRecordSchema = z.record(z.string(), z.string());

const formSchema = z.object({
  defaultActionType: z.string().trim().min(1, "Informe o tipo de ação."),
  defaultPolicies: z
    .string()
    .trim()
    .refine((raw) => {
      if (raw === "") {
        return true;
      }
      try {
        return policiesRecordSchema.safeParse(JSON.parse(raw)).success;
      } catch {
        return false;
      }
    }, "JSON inválido. Use um objeto { tipoDeAção: política }."),
  description: z.string().trim().min(1, "Informe uma descrição."),
  displayName: z.string().trim().min(1, "Informe o nome de exibição."),
  model: z.string().trim().min(1, "Informe o modelo."),
  systemPrompt: z.string().trim().min(1, "Informe o prompt do sistema."),
  workerKind: z.string().trim().min(1, "Informe o tipo (worker kind)."),
});

const isFieldKey = (key: PropertyKey | undefined): key is FieldKey =>
  typeof key === "string" && key in formSchema.shape;

const parsePolicies = (raw: string): Record<string, string> => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return {};
  }
  return policiesRecordSchema.parse(JSON.parse(trimmed));
};

const useTemplateForm = (initial: Template | undefined) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = initial !== undefined;

  const [values, setValues] = useState({
    defaultActionType: initial?.defaultActionType ?? "worker_deliverable",
    defaultPolicies: initial ? JSON.stringify(initial.defaultPolicies, null, 2) : "{}",
    description: initial?.description ?? "",
    displayName: initial?.displayName ?? "",
    model: initial?.model ?? "",
    systemPrompt: initial?.systemPrompt ?? "",
    workerKind: initial?.workerKind ?? "",
  });
  const [skillIds, setSkillIds] = useState<ReadonlyArray<string>>(initial?.skillIds ?? []);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryFn: fetchSkillCatalog,
    queryKey: templateKeys.skills,
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (input: TemplateInput) =>
      isEdit ? updateTemplate(initial.id, input) : createTemplate(input),
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `Erro ${error.status}: ${error.body || "falha ao salvar"}`
          : "Não foi possível salvar o modelo.";
      toast.error(message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success(isEdit ? "Modelo atualizado." : "Modelo criado.");
      router.push("/templates");
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: Template["status"]) => setTemplateStatus(initial?.id ?? "", status),
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `Erro ${error.status}: ${error.body || "falha"}`
          : "Não foi possível alterar o status.";
      toast.error(message);
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success(
        data.template.status === "retired" ? "Modelo desativado." : "Modelo reativado.",
      );
      router.refresh();
    },
  });

  const setField = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSkill = (id: string) => {
    setSkillIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const focusFirstError = (firstKey: FieldKey) => {
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstKey}"]`);
    el?.focus();
  };

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (isFieldKey(key) && fieldErrors[key] === undefined) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      const firstKey = parsed.error.issues[0]?.path[0];
      if (isFieldKey(firstKey)) {
        focusFirstError(firstKey);
      }
      return;
    }
    setErrors({});
    saveMutation.mutate({
      defaultActionType: parsed.data.defaultActionType,
      defaultPolicies: parsePolicies(parsed.data.defaultPolicies),
      description: parsed.data.description,
      displayName: parsed.data.displayName,
      model: parsed.data.model,
      skillIds,
      systemPrompt: parsed.data.systemPrompt,
      workerKind: parsed.data.workerKind,
    });
  };

  const handleToggleStatus = () => {
    if (!initial) {
      return;
    }
    statusMutation.mutate(initial.status === "retired" ? "active" : "retired");
  };

  const busy = saveMutation.isPending;
  const skills = skillsData?.items ?? [];
  const editLabel = isEdit ? "Salvar alterações" : "Criar modelo";
  const submitLabel = busy ? "Salvando…" : editLabel;

  return {
    busy,
    errors,
    formRef,
    handleSubmit,
    handleToggleStatus,
    setField,
    skillIds,
    skills,
    skillsLoading,
    statusPending: statusMutation.isPending,
    submitLabel,
    toggleSkill,
    values,
  };
};

export { useTemplateForm };
