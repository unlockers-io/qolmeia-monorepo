"use client";

import { Button } from "@repo/ui/components/button";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { cn } from "@repo/ui/lib/utils";
import { ApiError, describeRequestError } from "@repo/worker-api";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { confirmTeamSchema } from "@/lib/form-schemas";

type Template = {
  description: string;
  displayName: string;
  id: string;
  workerKind: string;
};

type OnboardingActionsProps = {
  companyId: string;
  templates: ReadonlyArray<Template>;
};

const ERROR_ID = "onboarding-templates-error";

const toggle = (ids: ReadonlyArray<string>, id: string): Array<string> =>
  ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id];

const confirmTeam = async (companyId: string, templateIds: ReadonlyArray<string>) => {
  const response = await fetch(`/api/teams/${companyId}/confirm`, {
    body: JSON.stringify({ templateIds }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
};

type TemplateOptionProps = {
  checked: boolean;
  invalid: boolean;
  onToggle: () => void;
  template: Template;
};

const TemplateOption = ({ checked, invalid, onToggle, template }: TemplateOptionProps) => {
  const inputId = `template-${template.id}`;

  return (
    <li>
      <label
        aria-label={template.displayName}
        className={cn(
          "flex h-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
          checked
            ? "border-primary bg-highlight-surface"
            : "border-border hover:border-input hover:bg-accent",
        )}
        htmlFor={inputId}
      >
        <input
          aria-describedby={invalid ? ERROR_ID : undefined}
          aria-invalid={invalid}
          aria-label={template.displayName}
          checked={checked}
          className="mt-0.5 size-4 accent-primary"
          id={inputId}
          onChange={onToggle}
          type="checkbox"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{template.displayName}</span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {template.description}
          </span>
        </span>
      </label>
    </li>
  );
};

const OnboardingActions = ({ companyId, templates }: OnboardingActionsProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { templateIds: templates.map((t) => t.id) },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await confirmTeam(companyId, value.templateIds);
      } catch (error) {
        setSubmitError(
          describeRequestError(error, "Não foi possível confirmar o Time. Tente de novo."),
        );

        return;
      }

      toast.success("Time confirmado! Redirecionando…");
      globalThis.location.assign("/");
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: confirmTeamSchema },
  });

  return (
    <div className="flex-none border-t border-border bg-card">
      <ClientReadyForm
        className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-5"
        id={form.formId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="size-4 text-primary" />
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Monte seu Time
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Escolha quem você quer no seu Time e clique em Confirmar.
        </p>
        <FormAlert message={submitError} />
        <form.Field name="templateIds">
          {(field) => {
            const isInvalid = !field.state.meta.isValid;

            return (
              <>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {templates.map((t) => (
                    <TemplateOption
                      checked={field.state.value.includes(t.id)}
                      invalid={isInvalid}
                      key={t.id}
                      onToggle={() => {
                        field.handleChange(toggle(field.state.value, t.id));
                      }}
                      template={t}
                    />
                  ))}
                </ul>
                {isInvalid && <FormFieldError errors={field.state.meta.errors} id={ERROR_ID} />}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase tabular-nums">
                    {field.state.value.length} de {templates.length} selecionado
                    {templates.length === 1 ? "" : "s"}
                  </span>
                  <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button disabled={isSubmitting} size="lg" type="submit">
                        {isSubmitting ? "Confirmando…" : "Confirmar Time"}
                      </Button>
                    )}
                  </form.Subscribe>
                </div>
              </>
            );
          }}
        </form.Field>
      </ClientReadyForm>
    </div>
  );
};

export { OnboardingActions };
