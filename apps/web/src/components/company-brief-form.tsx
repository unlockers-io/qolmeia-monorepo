"use client";

import { maxLengthHint } from "@repo/app-shell/form-limits";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { describeRequestError } from "@repo/worker-api";
import {
  BRIEF_MAX_LENGTH,
  briefCompleteness,
  type BriefPatch,
  type CompanyBrief,
} from "@repo/worker-api/brief";
import type { CompanyResponse } from "@repo/worker-api/contracts";
import { revalidateLogic, useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SkeletonBox } from "skullet/react";
import { toast } from "sonner";

import { MissingBriefBadge } from "@/components/missing-brief-badge";
import { fetchCompany, patchCompanyBrief } from "@/lib/company";
import { companyBriefSchema } from "@/lib/form-schemas";
import { queryKeys } from "@/lib/query-keys";

type FormState = {
  audience: string;
  industry: string;
  palette: string;
  primaryGoal: string;
  references: string;
  voice: string;
};

type BriefFieldName = keyof FormState;

const FIELDS = {
  audience: {
    id: "brief-audience",
    label: "Público-alvo",
    multiline: true,
    placeholder: "Quem é o cliente final: perfil, dor, contexto",
  },
  industry: {
    id: "brief-industry",
    label: "Setor",
    multiline: false,
    placeholder: "Ex: alimentação saudável",
  },
  palette: {
    id: "brief-palette",
    label: "Cores da marca",
    multiline: false,
    placeholder: "Ex: #E11D48, off-white",
  },
  primaryGoal: {
    id: "brief-goal",
    label: "Objetivo principal (3 meses)",
    multiline: false,
    placeholder: "Ex: aumentar vendas no Instagram",
  },
  references: {
    id: "brief-references",
    label: "Referências de marca",
    multiline: true,
    placeholder: "Marcas ou estilos que inspiram você",
  },
  voice: {
    id: "brief-voice",
    label: "Tom da marca",
    multiline: false,
    placeholder: "Ex: descontraído e próximo",
  },
} satisfies Record<
  BriefFieldName,
  { id: string; label: string; multiline: boolean; placeholder: string }
>;

const briefToForm = (brief: Partial<CompanyBrief>): FormState => ({
  audience: brief.audience ?? "",
  industry: brief.industry ?? "",
  palette: brief.brand?.palette ?? "",
  primaryGoal: brief.primaryGoal ?? "",
  references: brief.brand?.references ?? "",
  voice: brief.brand?.voice ?? "",
});

const buildPatch = (f: FormState): BriefPatch => {
  const patch: BriefPatch = {};

  if (f.industry.trim()) {
    patch.industry = f.industry.trim();
  }

  if (f.primaryGoal.trim()) {
    patch.primaryGoal = f.primaryGoal.trim();
  }

  if (f.audience.trim()) {
    patch.audience = f.audience.trim();
  }

  patch.brand = {
    palette: f.palette.trim() || undefined,
    references: f.references.trim() || undefined,
    voice: f.voice.trim() || undefined,
  };

  return patch;
};

const MissingMark = ({ show }: { show: boolean }) =>
  show ? <MissingBriefBadge className="ml-2 align-middle">A preencher</MissingBriefBadge> : null;

type BriefFieldProps = {
  field: {
    handleChange: (value: string) => void;
    state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
  };
  name: BriefFieldName;
};

const BriefField = ({ field, name }: BriefFieldProps) => {
  const isInvalid = !field.state.meta.isValid;
  const { value } = field.state;
  const { id, label, multiline, placeholder } = FIELDS[name];

  const control = {
    "aria-describedby": isInvalid ? `${id}-description ${id}-error` : `${id}-description`,
    "aria-invalid": isInvalid,
    autoComplete: "off",
    id,
    placeholder,
    value,
  };

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        <MissingMark show={!value.trim()} />
      </FieldLabel>
      {multiline ? (
        <Textarea
          {...control}
          onChange={(e) => {
            field.handleChange(e.currentTarget.value);
          }}
        />
      ) : (
        <Input
          {...control}
          onChange={(e) => {
            field.handleChange(e.currentTarget.value);
          }}
        />
      )}
      <FieldDescription id={`${id}-description`}>
        {maxLengthHint(BRIEF_MAX_LENGTH[name])}
      </FieldDescription>
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={`${id}-error`} />}
    </Field>
  );
};

type BriefCardProps = { companyId: string; initial: Partial<CompanyBrief> };

const BriefCard = ({ companyId, initial }: BriefCardProps) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.company(companyId);

  const mutation = useMutation({
    mutationFn: (patch: BriefPatch) => patchCompanyBrief(patch),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res);
      toast.success("Informações da empresa salvas.");
    },
  });

  const form = useForm({
    defaultValues: briefToForm(initial),
    listeners: {
      onChange: () => {
        mutation.reset();
      },
    },
    onSubmit: ({ value }) => {
      mutation.mutate(buildPatch(value));
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: companyBriefSchema },
  });

  const values = useSelector(form.store, (state) => state.values);
  const { isComplete, percent } = briefCompleteness(buildPatch(values));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 [.border-b]:pb-6">
        <CardTitle>
          <h2>Sobre a empresa</h2>
        </CardTitle>
        {isComplete ? (
          <StatusPill dotless label="Completo" tone="success" />
        ) : (
          <StatusPill dotless label={`${percent}% completo`} tone="neutral" />
        )}
      </CardHeader>
      <CardContent>
        <ClientReadyForm
          className="flex flex-col gap-5"
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FormAlert
            message={
              mutation.isError
                ? describeRequestError(mutation.error, "Não foi possível salvar. Tente novamente.")
                : null
            }
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <form.Field name="industry">
              {(field) => <BriefField field={field} name="industry" />}
            </form.Field>
            <form.Field name="primaryGoal">
              {(field) => <BriefField field={field} name="primaryGoal" />}
            </form.Field>
          </div>
          <form.Field name="audience">
            {(field) => <BriefField field={field} name="audience" />}
          </form.Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <form.Field name="voice">
              {(field) => <BriefField field={field} name="voice" />}
            </form.Field>
            <form.Field name="palette">
              {(field) => <BriefField field={field} name="palette" />}
            </form.Field>
          </div>
          <form.Field name="references">
            {(field) => <BriefField field={field} name="references" />}
          </form.Field>

          <div className="flex justify-end">
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </ClientReadyForm>
      </CardContent>
    </Card>
  );
};

type CompanyBriefFormProps = {
  companyId: string;
  initialData?: CompanyResponse;
};

const CompanyBriefForm = ({ companyId, initialData }: CompanyBriefFormProps) => {
  const { data, isPending } = useQuery({
    initialData,
    meta: { errorToast: "Falha ao carregar dados da empresa" },
    queryFn: () => fetchCompany(),
    queryKey: queryKeys.company(companyId),
  });

  if (isPending || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Sobre a empresa</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SkeletonBox height={36} width="100%" />
          <SkeletonBox height={80} width="100%" />
        </CardContent>
      </Card>
    );
  }

  return (
    <BriefCard
      companyId={companyId}
      initial={data.company.brief}
      key={JSON.stringify(data.company.brief)}
    />
  );
};

export { CompanyBriefForm };
