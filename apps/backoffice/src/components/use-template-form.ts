import { maxLength } from "@repo/app-shell/form-limits";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { apiGet, describeRequestError } from "@repo/worker-api";
import {
  ACTION_TYPES,
  ActionPolicy,
  type ActionType,
  actionTypeSchema,
  DEFAULT_ACTION_TYPE,
  type SkillId,
  TEMPLATE_MAX_LENGTH,
  type Template,
  type TemplateInput,
  templateInputSchema,
} from "@repo/worker-api/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  createTemplate,
  getSkillCatalog,
  isSkillId,
  templateKeys,
  updateTemplate,
} from "@/lib/backoffice-api";
import { useToggleTemplateStatus } from "@/lib/use-toggle-template-status";

const ACTION_TYPE_LIST = ACTION_TYPES.join(", ");

const POLICY_LIST = new Intl.ListFormat("pt-BR", { type: "disjunction" }).format(
  Object.values(ActionPolicy),
);

const policiesSchema = templateInputSchema.shape.defaultPolicies;

const isActionType = (value: unknown): value is ActionType =>
  actionTypeSchema.safeParse(value).success;

const formSchema = z.object({
  defaultActionType: z.custom<ActionType>(
    isActionType,
    `Use um destes tipos: ${ACTION_TYPE_LIST}.`,
  ),
  defaultPolicies: z
    .string()
    .trim()
    .refine((raw) => {
      if (raw === "") {
        return true;
      }

      try {
        return policiesSchema.safeParse(JSON.parse(raw)).success;
      } catch {
        return false;
      }
    }, `Use um objeto { tipoDeAção: política } com ${ACTION_TYPE_LIST} e ${POLICY_LIST}.`),
  description: maxLength(TEMPLATE_MAX_LENGTH.description).min(1, "Informe uma descrição."),
  displayName: maxLength(TEMPLATE_MAX_LENGTH.displayName).min(1, "Informe o nome de exibição."),
  model: maxLength(TEMPLATE_MAX_LENGTH.model).min(1, "Informe o modelo."),
  systemPrompt: maxLength(TEMPLATE_MAX_LENGTH.systemPrompt).min(1, "Informe o prompt do sistema."),
  workerKind: maxLength(TEMPLATE_MAX_LENGTH.workerKind).min(1, "Informe o tipo (worker kind)."),
});

type FieldKey = keyof z.infer<typeof formSchema>;

const isFieldKey = (key: PropertyKey | undefined): key is FieldKey =>
  typeof key === "string" && key in formSchema.shape;

const fieldErrors = (values: Record<FieldKey, string>): Partial<Record<FieldKey, string>> => {
  const errors: Partial<Record<FieldKey, string>> = {};

  for (const issue of formSchema.safeParse(values).error?.issues ?? []) {
    const key = issue.path[0];

    if (isFieldKey(key) && errors[key] === undefined) {
      errors[key] = issue.message;
    }
  }

  return errors;
};

const parsePolicies = (raw: string): TemplateInput["defaultPolicies"] => {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return {};
  }

  return policiesSchema.parse(JSON.parse(trimmed));
};

const EMPTY_FORM_VALUES: Record<FieldKey, string> = {
  defaultActionType: DEFAULT_ACTION_TYPE,
  defaultPolicies: "{}",
  description: "",
  displayName: "",
  model: "",
  systemPrompt: "",
  workerKind: "",
};

const toFormValues = (initial: Template | undefined): Record<FieldKey, string> =>
  initial === undefined
    ? EMPTY_FORM_VALUES
    : {
        defaultActionType: initial.defaultActionType,
        defaultPolicies: JSON.stringify(initial.defaultPolicies, null, 2),
        description: initial.description,
        displayName: initial.displayName,
        model: initial.model,
        systemPrompt: initial.systemPrompt,
        workerKind: initial.workerKind,
      };

const useTemplateForm = (initial: Template | undefined) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const formId = useId();

  const isEdit = initial !== undefined;

  const [values, setValues] = useState(() => toFormValues(initial));

  const [skillIds, setSkillIds] = useState<Array<SkillId>>(() =>
    (initial?.skillIds ?? []).filter(isSkillId),
  );

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const errors = submitAttempted ? fieldErrors(values) : {};

  const { data: skillCatalog, isError: skillsFailed } = useQuery({
    queryFn: () => getSkillCatalog(apiGet),
    queryKey: templateKeys.skills,
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: (input: TemplateInput) =>
      isEdit ? updateTemplate(initial.id, input) : createTemplate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success(isEdit ? "Modelo atualizado." : "Modelo criado.");
      router.push("/templates");
    },
  });

  const toggleStatus = useToggleTemplateStatus();

  const setField = (key: FieldKey, value: string) => {
    saveMutation.reset();
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSkill = (id: SkillId) => {
    saveMutation.reset();
    setSkillIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    const parsed = formSchema.safeParse(values);

    if (!parsed.success) {
      focusFirstInvalidField(formId);

      return;
    }

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

    toggleStatus.mutate(initial, {
      onSuccess: () => {
        router.refresh();
      },
    });
  };

  const busy = saveMutation.isPending;

  const submitError =
    saveMutation.error === null
      ? null
      : describeRequestError(saveMutation.error, "Não foi possível salvar o modelo.");

  const skills = skillCatalog ?? (skillsFailed ? [] : null);
  const editLabel = isEdit ? "Salvar alterações" : "Criar modelo";
  const submitLabel = busy ? "Salvando…" : editLabel;

  return {
    busy,
    errors,
    formId,
    handleSubmit,
    handleToggleStatus,
    setField,
    skillIds,
    skills,
    statusPending: toggleStatus.isPending,
    submitError,
    submitLabel,
    toggleSkill,
    values,
  };
};

export { POLICY_LIST, useTemplateForm };

export type { FieldKey };
