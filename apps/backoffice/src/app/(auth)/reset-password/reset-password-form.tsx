"use client";

import { authClient, authErrorMessage } from "@repo/app-shell/auth-client";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
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

      try {
        const { error } = await authClient.resetPassword({
          newPassword: value.password,
          token,
        });

        if (error) {
          setSubmitError(authErrorMessage(error, "Não foi possível redefinir a senha."));

          return;
        }
      } catch {
        setSubmitError("Não foi possível conectar ao servidor. Tente novamente.");

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
              {(field) => {
                const isInvalid = !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Nova senha</FieldLabel>
                    <Input
                      aria-describedby={
                        isInvalid
                          ? `${field.name}-description ${field.name}-error`
                          : `${field.name}-description`
                      }
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      type="password"
                      value={field.state.value}
                    />
                    <FieldDescription id={`${field.name}-description`}>
                      Pelo menos 12 caracteres.
                    </FieldDescription>
                    {isInvalid && (
                      <FormFieldError errors={field.state.meta.errors} id={`${field.name}-error`} />
                    )}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => {
                const isInvalid = !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Confirmar nova senha</FieldLabel>
                    <Input
                      aria-describedby={isInvalid ? `${field.name}-error` : undefined}
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      type="password"
                      value={field.state.value}
                    />
                    {isInvalid && (
                      <FormFieldError errors={field.state.meta.errors} id={`${field.name}-error`} />
                    )}
                  </Field>
                );
              }}
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
