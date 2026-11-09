"use client";

import { authClient, authRequest } from "@repo/app-shell/auth-client";
import { PasswordField } from "@repo/app-shell/auth-fields";
import { PASSWORD_HINT } from "@repo/app-shell/auth-schemas";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthFormCard } from "@/app/(auth)/auth-form-card";
import { resetPasswordSchema } from "@/lib/form-schemas";

const ResetPasswordForm = ({ token }: { token: string }) => {
  const { push } = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", password: "" },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const { error } = await authRequest(
        () => authClient.resetPassword({ newPassword: value.password, token }),
        "Não foi possível redefinir a senha.",
      );

      if (error !== null) {
        setSubmitError(error);

        return;
      }

      toast.success("Senha redefinida com sucesso.");
      push("/login");
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: resetPasswordSchema },
  });

  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <AuthFormCard
          description="Crie uma nova senha para sua conta."
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
          pendingLabel="Salvando…"
          submitLabel="Redefinir senha"
          title="Redefinir senha"
        >
          <form.Field name="password">
            {(field) => (
              <PasswordField
                autoComplete="new-password"
                description={PASSWORD_HINT}
                field={field}
                label="Nova senha"
              />
            )}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => (
              <PasswordField
                autoComplete="new-password"
                field={field}
                label="Confirmar nova senha"
              />
            )}
          </form.Field>
        </AuthFormCard>
      )}
    </form.Subscribe>
  );
};

export { ResetPasswordForm };
