"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { DialogCloseButton } from "@repo/ui/compositions/dialog-close-button";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { describeRequestError } from "@repo/worker-api";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";

import { hireSchema } from "@/lib/form-schemas";
import { hireMember, type HireableTemplate } from "@/lib/team";

type HireFormProps = {
  onClose: () => void;
  onHired: () => void;
  template: HireableTemplate | null;
};

type HireDialogProps = HireFormProps & { open: boolean };

const HireForm = ({ onClose, onHired, template }: HireFormProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { displayName: "" },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      if (!template) {
        return;
      }
      setSubmitError(null);
      try {
        const member = await hireMember({
          displayName: value.displayName.trim() || undefined,
          templateId: template.id,
        });
        toast.success(`${member.displayName} contratado(a).`);
        onHired();
        onClose();
      } catch (error) {
        setSubmitError(describeRequestError(error, "Não foi possível contratar. Tente de novo."));
      }
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: hireSchema },
  });

  return (
    <ClientReadyForm
      className="contents"
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
          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor="hire-name">Nome (opcional)</FieldLabel>
              <Input
                aria-describedby={
                  isInvalid ? "hire-name-description hire-name-error" : "hire-name-description"
                }
                aria-invalid={isInvalid}
                autoComplete="off"
                id="hire-name"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                placeholder={template?.displayName ?? ""}
                value={field.state.value}
              />
              <FieldDescription id="hire-name-description">Até 80 caracteres.</FieldDescription>
              {isInvalid && (
                <FormFieldError errors={field.state.meta.errors} id="hire-name-error" />
              )}
            </Field>
          );
        }}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Contratando…" : "Contratar"}
            </Button>
          </DialogFooter>
        )}
      </form.Subscribe>
    </ClientReadyForm>
  );
};

const HireDialog = ({ onClose, onHired, open, template }: HireDialogProps) => (
  <Dialog
    onOpenChange={(o) => {
      if (!o) {
        onClose();
      }
    }}
    open={open}
  >
    <DialogContent className="sm:max-w-lg" showCloseButton={false}>
      <DialogCloseButton />
      <DialogHeader>
        <DialogTitle>Contratar {template?.displayName ?? ""}</DialogTitle>
        <DialogDescription>
          Dê um nome próprio a este agente, se quiser. Em branco, ele se chama{" "}
          {template?.displayName ?? "pelo nome da função"}.
        </DialogDescription>
      </DialogHeader>
      <HireForm onClose={onClose} onHired={onHired} template={template} />
    </DialogContent>
  </Dialog>
);

export { HireDialog };
