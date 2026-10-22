"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import type {
  CustomerInvitationInput,
  CustomerInvitationResponse,
} from "@repo/worker-api/contracts";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { toast } from "sonner";

import { ApiError, apiSend, describeRequestError } from "@/lib/api-client";
import { inviteCustomerSchema } from "@/lib/form-schemas";

const CONFLICT = 409;

const InviteCustomerForm = ({ companyId }: { companyId: string }) => {
  const emailId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ formApi, value }) => {
      const body: CustomerInvitationInput = { email: value.email };
      try {
        const { invitation } = await apiSend<CustomerInvitationResponse>(
          "POST",
          `/companies/${companyId}/invitations`,
          body,
        );
        toast.success(`Convite enviado para ${invitation.email}.`);
        formApi.reset();
      } catch (error) {
        toast.error(
          error instanceof ApiError && error.status === CONFLICT
            ? "Este e-mail já pertence a uma conta com acesso."
            : describeRequestError(error, "Não foi possível enviar o convite."),
        );
      }
    },
    onSubmitInvalid: () => {
      focusFirstInvalidField(formRef.current);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: inviteCustomerSchema },
  });

  return (
    <ClientReadyForm
      className="flex flex-col gap-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      ref={formRef}
    >
      <form.Field name="email">
        {(field) => {
          const isInvalid = !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor={emailId}>Convidar cliente</FieldLabel>
              <div className="flex gap-2">
                <Input
                  aria-describedby={isInvalid ? `${emailId}-error` : undefined}
                  aria-invalid={isInvalid}
                  autoComplete="off"
                  id={emailId}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="cliente@empresa.com"
                  type="email"
                  value={field.state.value}
                />
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button className="shrink-0" disabled={isSubmitting} type="submit">
                      {isSubmitting ? "Enviando…" : "Convidar"}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
              {isInvalid && (
                <FormFieldError errors={field.state.meta.errors} id={`${emailId}-error`} />
              )}
            </Field>
          );
        }}
      </form.Field>
    </ClientReadyForm>
  );
};

export { InviteCustomerForm };
