"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";

import { describeRequestError } from "@/lib/api-client";
import { memberNameSchema } from "@/lib/form-schemas";

type MemberNameFormProps = {
  busy: boolean;
  displayName: string;
  onRename: (displayName: string) => Promise<void>;
};

const MemberNameForm = ({ busy, displayName, onRename }: MemberNameFormProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { displayName },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ formApi, value }) => {
      setSubmitError(null);
      const next = value.displayName.trim();
      try {
        await onRename(next);
        formApi.reset({ displayName: next });
      } catch (error) {
        setSubmitError(describeRequestError(error, "Não foi possível salvar. Tente de novo."));
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: memberNameSchema },
  });

  return (
    <ClientReadyForm
      className="flex flex-col gap-2"
      id={form.formId}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FormAlert message={submitError} />
      <form.Field name="displayName">
        {(field) => {
          const isInvalid = !field.state.meta.isValid;
          const name = field.state.value.trim();
          const isEmpty = name === "";
          const isUnchanged = name === displayName;
          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor="member-name">Nome de exibição</FieldLabel>
              <div className="flex gap-2">
                <Input
                  aria-describedby={
                    isInvalid
                      ? "member-name-description member-name-error"
                      : "member-name-description"
                  }
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  disabled={busy}
                  id="member-name"
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  value={field.state.value}
                />
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      disabled={busy || isSubmitting || isEmpty || isUnchanged}
                      type="submit"
                      variant="outline"
                    >
                      Renomear
                    </Button>
                  )}
                </form.Subscribe>
              </div>
              <FieldDescription id="member-name-description">Até 80 caracteres.</FieldDescription>
              {isInvalid && (
                <FormFieldError errors={field.state.meta.errors} id="member-name-error" />
              )}
            </Field>
          );
        }}
      </form.Field>
    </ClientReadyForm>
  );
};

export { MemberNameForm };
