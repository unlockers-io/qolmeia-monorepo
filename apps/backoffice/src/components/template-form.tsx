"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { ACTION_TYPES, type Template } from "@repo/worker-api/contracts";
import { useId } from "react";

import { BackLink } from "@/components/back-link";

import { TemplateFormSkillPicker } from "./template-form-skill-picker";
import { useTemplateForm } from "./use-template-form";

type TemplateFormProps = {
  initial?: Template;
};

const fieldError = (message: string | undefined): [string] | undefined =>
  message !== undefined && message !== "" ? [message] : undefined;

const TemplateForm = ({ initial }: TemplateFormProps) => {
  const policiesFieldId = useId();
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
            {initial.status === "retired" ? "Reativar" : "Desativar"}
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
              <Field>
                <FieldLabel htmlFor="displayName">Nome de exibição</FieldLabel>
                <Input
                  aria-describedby={
                    errors.displayName === undefined ? undefined : "displayName-error"
                  }
                  aria-invalid={errors.displayName !== undefined}
                  disabled={busy}
                  id="displayName"
                  name="displayName"
                  onChange={(e) => {
                    setField("displayName", e.target.value);
                  }}
                  value={values.displayName}
                />
                <FormFieldError errors={fieldError(errors.displayName)} id="displayName-error" />
              </Field>

              <Field>
                <FieldLabel htmlFor="workerKind">Tipo (worker kind)</FieldLabel>
                <Input
                  aria-describedby={
                    errors.workerKind === undefined ? undefined : "workerKind-error"
                  }
                  aria-invalid={errors.workerKind !== undefined}
                  autoComplete="off"
                  disabled={busy}
                  id="workerKind"
                  name="workerKind"
                  onChange={(e) => {
                    setField("workerKind", e.target.value);
                  }}
                  placeholder="seo-researcher"
                  value={values.workerKind}
                />
                <FormFieldError errors={fieldError(errors.workerKind)} id="workerKind-error" />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="description">Descrição</FieldLabel>
              <Input
                aria-describedby={
                  errors.description === undefined ? undefined : "description-error"
                }
                aria-invalid={errors.description !== undefined}
                disabled={busy}
                id="description"
                name="description"
                onChange={(e) => {
                  setField("description", e.target.value);
                }}
                value={values.description}
              />
              <FormFieldError errors={fieldError(errors.description)} id="description-error" />
            </Field>

            <Field>
              <FieldLabel htmlFor="systemPrompt">Prompt do sistema</FieldLabel>
              <div className="font-mono">
                <Textarea
                  aria-describedby={
                    errors.systemPrompt === undefined ? undefined : "systemPrompt-error"
                  }
                  aria-invalid={errors.systemPrompt !== undefined}
                  disabled={busy}
                  id="systemPrompt"
                  name="systemPrompt"
                  onChange={(e) => {
                    setField("systemPrompt", e.target.value);
                  }}
                  value={values.systemPrompt}
                />
              </div>
              <FormFieldError errors={fieldError(errors.systemPrompt)} id="systemPrompt-error" />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="model">Modelo (LLM)</FieldLabel>
                <Input
                  aria-describedby={errors.model === undefined ? undefined : "model-error"}
                  aria-invalid={errors.model !== undefined}
                  autoComplete="off"
                  disabled={busy}
                  id="model"
                  name="model"
                  onChange={(e) => {
                    setField("model", e.target.value);
                  }}
                  placeholder="openai/gpt-6.1-sol"
                  value={values.model}
                />
                <FormFieldError errors={fieldError(errors.model)} id="model-error" />
              </Field>

              <Field>
                <FieldLabel htmlFor="defaultActionType">Tipo de ação padrão</FieldLabel>
                <Input
                  aria-describedby={
                    errors.defaultActionType === undefined
                      ? "defaultActionType-description"
                      : "defaultActionType-description defaultActionType-error"
                  }
                  aria-invalid={errors.defaultActionType !== undefined}
                  autoComplete="off"
                  disabled={busy}
                  id="defaultActionType"
                  name="defaultActionType"
                  onChange={(e) => {
                    setField("defaultActionType", e.target.value);
                  }}
                  value={values.defaultActionType}
                />
                <FieldDescription id="defaultActionType-description">
                  Um destes: {ACTION_TYPES.join(", ")}.
                </FieldDescription>
                <FormFieldError
                  errors={fieldError(errors.defaultActionType)}
                  id="defaultActionType-error"
                />
              </Field>
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
            <Field>
              <FieldLabel htmlFor={policiesFieldId}>Políticas padrão (JSON)</FieldLabel>
              <FieldDescription id={`${policiesFieldId}-description`}>
                Objeto {`{ tipoDeAção: política }`}, com política require_approval, notify_only ou
                auto_execute. Vazio = nenhuma política.
              </FieldDescription>
              <div className="font-mono">
                <Textarea
                  aria-describedby={
                    errors.defaultPolicies === undefined
                      ? `${policiesFieldId}-description`
                      : `${policiesFieldId}-description ${policiesFieldId}-error`
                  }
                  aria-invalid={errors.defaultPolicies !== undefined}
                  disabled={busy}
                  id={policiesFieldId}
                  name="defaultPolicies"
                  onChange={(e) => {
                    setField("defaultPolicies", e.target.value);
                  }}
                  spellCheck={false}
                  value={values.defaultPolicies}
                />
              </div>
              <FormFieldError
                errors={fieldError(errors.defaultPolicies)}
                id={`${policiesFieldId}-error`}
              />
            </Field>
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
