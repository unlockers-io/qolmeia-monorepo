"use client";

import { authClient, authRequest, type AuthError } from "@repo/app-shell/auth-client";
import { EmailField, PasswordField } from "@repo/app-shell/auth-fields";
import { loginSchema } from "@repo/app-shell/auth-schemas";
import { safeRedirectPath } from "@repo/auth/redirect-path";
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
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  registerPrompt?: ReactNode;
  searchParams: Promise<{ from?: string }>;
};

type LoginDependencies = {
  signInEmail: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: AuthError | null }>;
  useAppRouter: () => Pick<ReturnType<typeof useRouter>, "push" | "refresh">;
};

const createLoginForm = ({ signInEmail, useAppRouter }: LoginDependencies) => {
  const Form = ({ registerPrompt, searchParams }: Props) => {
    const { push, refresh } = useAppRouter();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const form = useForm({
      defaultValues: { email: "", password: "" },
      listeners: {
        onChange: () => {
          setSubmitError(null);
        },
      },
      onSubmit: async ({ value }) => {
        setSubmitError(null);

        const { error } = await authRequest(
          () => signInEmail({ email: value.email, password: value.password }),
          "Não foi possível entrar. Verifique seus dados.",
        );

        if (error !== null) {
          setSubmitError(error);

          return;
        }

        const { from } = await searchParams;
        push(safeRedirectPath(from));
        refresh();
      },
      onSubmitInvalid: ({ formApi }) => {
        focusFirstInvalidField(formApi.formId);
      },
      validationLogic: revalidateLogic(),
      validators: { onDynamic: loginSchema },
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
            <h1>Entrar</h1>
          </CardTitle>
          <CardDescription>Acesse o painel operacional da Qolmeia.</CardDescription>
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
              <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
              <form.Field name="password">
                {(field) => (
                  <PasswordField autoComplete="current-password" field={field} label="Senha" />
                )}
              </form.Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
                  {isSubmitting ? "Entrando…" : "Entrar"}
                </Button>
              )}
            </form.Subscribe>
            <Link
              className="rounded-sm py-2 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              href="/recover"
            >
              Esqueci minha senha
            </Link>
            {registerPrompt}
          </CardFooter>
        </ClientReadyForm>
      </Card>
    );
  };

  return Form;
};

const LoginForm = createLoginForm({
  signInEmail: async (credentials) => {
    const { error } = await authClient.signIn.email(credentials);

    return { error };
  },
  useAppRouter: useRouter,
});

export { createLoginForm, LoginForm };

export type { LoginDependencies };
