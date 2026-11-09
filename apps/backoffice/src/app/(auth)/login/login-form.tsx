"use client";

import { authClient, authRequest, type AuthError } from "@repo/app-shell/auth-client";
import { EmailField, PasswordField } from "@repo/app-shell/auth-fields";
import { loginSchema } from "@repo/app-shell/auth-schemas";
import { safeRedirectPath } from "@repo/auth/redirect-path";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { AuthFormCard } from "@/app/(auth)/auth-form-card";

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

    return (
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <AuthFormCard
            description="Acesse o painel operacional da Qolmeia."
            error={submitError}
            footer={
              <>
                <Link
                  className="rounded-sm py-2 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  href="/recover"
                >
                  Esqueci minha senha
                </Link>
                {registerPrompt}
              </>
            }
            formId={form.formId}
            isSubmitting={isSubmitting}
            onSubmit={() => form.handleSubmit()}
            pendingLabel="Entrando…"
            submitLabel="Entrar"
            title="Entrar"
          >
            <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
            <form.Field name="password">
              {(field) => (
                <PasswordField autoComplete="current-password" field={field} label="Senha" />
              )}
            </form.Field>
          </AuthFormCard>
        )}
      </form.Subscribe>
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
