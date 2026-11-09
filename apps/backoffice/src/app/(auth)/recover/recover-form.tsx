"use client";

import { authClient, authRequest } from "@repo/app-shell/auth-client";
import { EmailField } from "@repo/app-shell/auth-fields";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AuthFormCard } from "@/app/(auth)/auth-form-card";
import { recoverSchema } from "@/lib/form-schemas";

const RecoverForm = () => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const { error } = await authRequest(
        () =>
          authClient.requestPasswordReset({ email: value.email, redirectTo: "/reset-password" }),
        "Não foi possível enviar o link.",
      );

      if (error !== null) {
        setSubmitError(error);

        return;
      }

      toast.success("Enviamos um link para seu e-mail.");
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: recoverSchema },
  });

  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <AuthFormCard
          description="Informe o e-mail cadastrado para receber o link de redefinição."
          error={submitError}
          footer={
            <p className="text-center text-sm text-muted-foreground">
              <Link
                className="font-medium text-primary underline-offset-4 hover:underline"
                href="/login"
              >
                Voltar para o login
              </Link>
            </p>
          }
          formId={form.formId}
          isSubmitting={isSubmitting}
          onSubmit={() => form.handleSubmit()}
          pendingLabel="Enviando…"
          submitLabel="Enviar link"
          title="Recuperar senha"
        >
          <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
        </AuthFormCard>
      )}
    </form.Subscribe>
  );
};

export { RecoverForm };
