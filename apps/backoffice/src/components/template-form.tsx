"use client";

import { maxLengthHint } from "@repo/app-shell/form-limits";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { ACTION_TYPES, TEMPLATE_MAX_LENGTH, type Template } from "@repo/worker-api/contracts";

import { BackLink } from "@/components/back-link";
import { TOGGLE_LABEL } from "@/lib/use-toggle-template-status";

import { TemplateFormSkillPicker } from "./template-form-skill-picker";
import { type FieldKey, POLICY_LIST, useTemplateForm } from "./use-template-form";

type TemplateFormProps = {
  initial?: Template;
};

const fieldError = (message: string | undefined): [string] | undefined =>
  message !== undefined && message !== "" ? [message] : undefined;

type TemplateFieldProps = {
  autoComplete?: "off";
  busy: boolean;
  description: string;
  error: string | undefined;
  label: string;
  multiline?: boolean;
  name: FieldKey;
  onChange: (name: FieldKey, value: string) => void;
  placeholder?: string;
  spellCheck?: false;
  value: string;
};

const TemplateField = ({
  autoComplete,
  busy,
  description,
  error,
  label,
  multiline = false,
  name,
  onChange,
  placeholder,
  spellCheck,
  value,
}: TemplateFieldProps) => {
  const control = {
    "aria-describedby":
      error === undefined ? `${name}-description` : `${name}-description ${name}-error`,
    "aria-invalid": error !== undefined,
    disabled: busy,
    id: name,
    name,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(name, event.target.value);
    },
    spellCheck,
    value,
  };

  return (
    <Field data-invalid={error !== undefined || undefined}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {multiline ? (
        <div className="font-mono">
          <Textarea {...control} />
        </div>
      ) : (
        <Input {...control} autoComplete={autoComplete} placeholder={placeholder} />
      )}
      <FieldDescription id={`${name}-description`}>{description}</FieldDescription>
      <FormFieldError errors={fieldError(error)} id={`${name}-error`} />
    </Field>
  );
};

const TemplateForm = ({ initial }: TemplateFormProps) => {
  const ready = useClientReady();

  const {
    busy,
    errors,
    formId,
    handleSubmit,
    handleToggleStatus,
    setField,
    skillIds,
    skills,
    skillsLoading,
    statusPending,
    submitError,
    submitLabel,
    toggleSkill,
    values,
  } = useTemplateForm(initial);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/templates">Modelos</BackLink>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {initial === undefined ? "Novo modelo" : "Editar modelo"}
        </h1>
        {initial === undefined ? null : (
          <Button
            disabled={!ready || statusPending}
            onClick={handleToggleStatus}
            type="button"
            variant="outline"
          >
            {TOGGLE_LABEL[initial.status]}
          </Button>
        )}
      </header>

      <ClientReadyForm
        className="flex flex-col gap-5"
        id={formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <FormAlert message={submitError} />
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TemplateField
                busy={busy}
                description={maxLengthHint(TEMPLATE_MAX_LENGTH.displayName)}
                error={errors.displayName}
                label="Nome de exibição"
                name="displayName"
                onChange={setField}
                value={values.displayName}
              />
              <TemplateField
                autoComplete="off"
                busy={busy}
                description={maxLengthHint(TEMPLATE_MAX_LENGTH.workerKind)}
                error={errors.workerKind}
                label="Tipo (worker kind)"
                name="workerKind"
                onChange={setField}
                placeholder="seo-researcher"
                value={values.workerKind}
              />
            </div>

            <TemplateField
              busy={busy}
              description={maxLengthHint(TEMPLATE_MAX_LENGTH.description)}
              error={errors.description}
              label="Descrição"
              name="description"
              onChange={setField}
              value={values.description}
            />

            <TemplateField
              busy={busy}
              description={maxLengthHint(TEMPLATE_MAX_LENGTH.systemPrompt)}
              error={errors.systemPrompt}
              label="Prompt do sistema"
              multiline
              name="systemPrompt"
              onChange={setField}
              value={values.systemPrompt}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <TemplateField
                autoComplete="off"
                busy={busy}
                description={maxLengthHint(TEMPLATE_MAX_LENGTH.model)}
                error={errors.model}
                label="Modelo (LLM)"
                name="model"
                onChange={setField}
                placeholder="openai/gpt-6.1-sol"
                value={values.model}
              />
              <TemplateField
                autoComplete="off"
                busy={busy}
                description={`Um destes: ${ACTION_TYPES.join(", ")}.`}
                error={errors.defaultActionType}
                label="Tipo de ação padrão"
                name="defaultActionType"
                onChange={setField}
                value={values.defaultActionType}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-sm font-semibold text-foreground">Habilidades</legend>
              <p className="text-xs text-muted-foreground">
                As habilidades (skills) que este especialista pode usar.
              </p>
              <TemplateFormSkillPicker
                busy={busy}
                loading={skillsLoading}
                onToggle={toggleSkill}
                selected={skillIds}
                skills={skills}
              />
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <TemplateField
              busy={busy}
              description={`Objeto { tipoDeAção: política }, com política ${POLICY_LIST}. Vazio = nenhuma política.`}
              error={errors.defaultPolicies}
              label="Políticas padrão (JSON)"
              multiline
              name="defaultPolicies"
              onChange={setField}
              spellCheck={false}
              value={values.defaultPolicies}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button disabled={busy} type="submit">
            {submitLabel}
          </Button>
        </div>
      </ClientReadyForm>
    </div>
  );
};

export { TemplateForm };
