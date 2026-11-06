"use client";

import { authClient, authRequest } from "@repo/app-shell/auth-client";
import { PasswordField } from "@repo/app-shell/auth-fields";
import { PASSWORD_HINT } from "@repo/app-shell/auth-schemas";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { FieldGroup } from "@repo/ui/components/field";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Redefinir senha</h1>
        </CardTitle>
        <CardDescription>Crie uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <ClientReadyForm
        className="flex flex-col gap-(--card-spacing)"
        id={form.formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <CardContent>
          <FieldGroup>
            <FormAlert message={submitError} />
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
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
                {isSubmitting ? "Salvando…" : "Redefinir senha"}
              </Button>
            )}
          </form.Subscribe>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="/login"
            >
              Voltar para o login
            </Link>
          </p>
        </CardFooter>
      </ClientReadyForm>
    </Card>
  );
};

export { ResetPasswordForm };
