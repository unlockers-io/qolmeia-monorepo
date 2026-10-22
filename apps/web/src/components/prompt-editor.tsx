"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { describeRequestError } from "@repo/worker-api";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";

import { promptSchema } from "@/lib/form-schemas";

type PromptEditorProps = {
  busy?: boolean;
  initialValue: string | null;
  onReset: () => Promise<void>;
  onSave: (value: string) => Promise<void>;
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

const PromptEditor = ({ busy, initialValue, onReset, onSave, updatedAt }: PromptEditorProps) => {
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
    <section aria-label="Comportamento do agente">
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
                  <FieldLabel htmlFor="prompt-editor">Instruções para este agente</FieldLabel>
                  <Textarea
                    aria-describedby={
                      isInvalid
                        ? "prompt-editor-description prompt-editor-error"
                        : "prompt-editor-description"
                    }
                    aria-invalid={isInvalid}
                    disabled={busy}
                    id="prompt-editor"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    placeholder="Ex.: Use um tom descontraído e sempre inclua o endereço da loja."
                    rows={8}
                    value={field.state.value}
                  />
                  <FieldDescription id="prompt-editor-description">
                    {overridden && updatedAt !== null
                      ? `Você personalizou estas instruções em ${formatDate(updatedAt)}. `
                      : ""}
                    Mudanças passam a valer na próxima interação. Até 20.000 caracteres.
                  </FieldDescription>
                  {isInvalid && (
                    <FormFieldError errors={field.state.meta.errors} id="prompt-editor-error" />
                  )}
                </Field>
                <div className="flex justify-end gap-2">
                  <Button
                    disabled={busy === true || !overridden}
                    onClick={() => {
                      void handleReset();
                    }}
                    type="button"
                    variant="outline"
                  >
                    Restaurar padrão
                  </Button>
                  <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        disabled={busy === true || isSubmitting || isEmpty || isUnchanged}
                        type="submit"
                      >
                        Salvar
                      </Button>
                    )}
                  </form.Subscribe>
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
