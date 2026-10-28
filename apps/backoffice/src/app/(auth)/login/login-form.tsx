"use client";

import { authClient, authErrorMessage } from "@repo/app-shell/auth-client";
import { safeRedirectPath } from "@repo/app-shell/redirect-path";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";

import { loginSchema } from "@/lib/form-schemas";

type Props = {
  registerPrompt?: ReactNode;
  searchParams: Promise<{ from?: string }>;
};

type LoginDependencies = {
  signInEmail: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: { code?: string; status?: number } | null }>;
  useAppRouter: () => Pick<ReturnType<typeof useRouter>, "push" | "refresh">;
};

const createLoginForm = ({ signInEmail, useAppRouter }: LoginDependencies) => {
  const Form = ({ registerPrompt, searchParams }: Props) => {
    const { push, refresh } = useAppRouter();
    const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const form = useForm({
      defaultValues: { email: "", password: "" },
      listeners: {
        onChange: () => {
          setShowUnverifiedNotice(false);
          setSubmitError(null);
        },
      },
      onSubmit: async ({ value }) => {
        setShowUnverifiedNotice(false);
        setSubmitError(null);

        try {
          const { error } = await signInEmail({
            email: value.email,
            password: value.password,
          });

          if (error) {
            if (error.code === "EMAIL_NOT_VERIFIED") {
              setShowUnverifiedNotice(true);

              return;
            }

            setSubmitError(
              authErrorMessage(error, "Não foi possível entrar. Verifique seus dados."),
            );

            return;
          }
        } catch {
          setSubmitError("Não foi possível conectar ao servidor. Tente novamente.");

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
              <form.Field name="email">
                {(field) => {
                  const isInvalid = !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                      <Input
                        aria-describedby={isInvalid ? `${field.name}-error` : undefined}
                        aria-invalid={isInvalid}
                        autoComplete="email"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                        }}
                        placeholder="voce@empresa.com"
                        type="email"
                        value={field.state.value}
                      />
                      {isInvalid && (
                        <FormFieldError
                          errors={field.state.meta.errors}
                          id={`${field.name}-error`}
                        />
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="password">
                {(field) => {
                  const isInvalid = !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                      <Input
                        aria-describedby={isInvalid ? `${field.name}-error` : undefined}
                        aria-invalid={isInvalid}
                        autoComplete="current-password"
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
                        <FormFieldError
                          errors={field.state.meta.errors}
                          id={`${field.name}-error`}
                        />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
            </FieldGroup>

            {showUnverifiedNotice && (
              <output aria-live="polite" className="mt-4 block text-center text-sm">
                Este e-mail ainda não foi verificado. Acabamos de enviar um novo link.
              </output>
            )}
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
