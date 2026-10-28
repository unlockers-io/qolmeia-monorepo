"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription } from "@repo/ui/components/field";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";

import { describeRequestError } from "@/lib/api-client";
import { promptSchema } from "@/lib/form-schemas";

type PromptEditorProps = {
  busy?: boolean;
  initialValue: string | null;
  onReset: () => Promise<void>;
  onSave: (value: string) => Promise<void>;
  templatePrompt: string;
  updatedAt: number | null;
};

const SAVE_FAILED = "Não foi possível salvar. Tente de novo.";

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

const PromptEditor = ({
  busy,
  initialValue,
  onReset,
  onSave,
  templatePrompt,
  updatedAt,
}: PromptEditorProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const saved = initialValue ?? "";
  const overridden = initialValue !== null;

  const form = useForm({
    defaultValues: { prompt: saved },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await onSave(value.prompt.trim());
      } catch (error) {
        setSubmitError(describeRequestError(error, SAVE_FAILED));
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: promptSchema },
  });

  const handleReset = async () => {
    setSubmitError(null);

    try {
      await onReset();
      form.reset({ prompt: "" });
    } catch (error) {
      setSubmitError(describeRequestError(error, SAVE_FAILED));
    }
  };

  return (
    <section aria-label="Prompt do agente" className="flex flex-col gap-3">
      <div className="flex items-center">
        <span className="text-sm font-bold text-foreground">Prompt do agente</span>
        <span className="ml-auto font-mono text-xs tracking-wide text-muted-foreground">
          editável
        </span>
      </div>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Padrão do template
        </summary>
        <pre className="mt-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {templatePrompt}
        </pre>
      </details>

      <ClientReadyForm
        className="flex flex-col gap-3"
        id={form.formId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FormAlert message={submitError} />
        <form.Field name="prompt">
          {(field) => {
            const isInvalid = !field.state.meta.isValid;
            const prompt = field.state.value.trim();
            const isEmpty = prompt === "";
            const isUnchanged = prompt === saved;

            return (
              <>
                <Field data-invalid={isInvalid || undefined}>
                  <div className="font-mono">
                    <Textarea
                      aria-describedby={
                        isInvalid
                          ? "prompt-editor-description prompt-editor-error"
                          : "prompt-editor-description"
                      }
                      aria-invalid={isInvalid}
                      aria-label="Prompt do agente"
                      className="resize-y"
                      disabled={busy}
                      id="prompt-editor"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      placeholder="Escreva instruções específicas para este agente, em pt-BR."
                      rows={8}
                      value={field.state.value}
                    />
                  </div>
                  <FieldDescription id="prompt-editor-description">
                    {overridden && updatedAt !== null
                      ? `Você modificou este prompt em ${formatDate(updatedAt)}. `
                      : ""}
                    Mudanças passam a valer na próxima interação. Até 20.000 caracteres.
                  </FieldDescription>
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="prompt-editor-error" />
                  )}
                </Field>

                <div className="flex gap-2">
                  <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        disabled={busy === true || isSubmitting || isEmpty || isUnchanged}
                        type="submit"
                      >
                        Salvar prompt
                      </Button>
                    )}
                  </form.Subscribe>
                  <Button
                    disabled={busy === true || !overridden}
                    onClick={() => {
                      void handleReset();
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Descartar
                  </Button>
                </div>
              </>
            );
          }}
        </form.Field>
      </ClientReadyForm>
    </section>
  );
};

export { PromptEditor };
