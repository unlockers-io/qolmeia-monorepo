"use client";

import { authClient } from "@repo/app-shell/auth-client";
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
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { loginSchema } from "@/lib/form-schemas";
import { safeRedirectPath } from "@/lib/redirect-validation";

type Props = {
  registerPrompt?: ReactNode;
  searchParams: Promise<{ from?: string }>;
};

type LoginDependencies = {
  showError: (message: string) => void;
  signInEmail: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: { code?: string; message?: string } | null }>;
  useAppRouter: () => Pick<ReturnType<typeof useRouter>, "push" | "refresh">;
};

const createLoginForm = ({ showError, signInEmail, useAppRouter }: LoginDependencies) => {
  const Form = ({ registerPrompt, searchParams }: Props) => {
    const { push, refresh } = useAppRouter();
    const [showUnverifiedNotice, setShowUnverifiedNotice] = useState(false);

    const form = useForm({
      defaultValues: { email: "", password: "" },
      onSubmit: async ({ value }) => {
        setShowUnverifiedNotice(false);
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
            showError(error.message ?? "Não foi possível entrar. Verifique seus dados.");
            return;
          }
        } catch {
          showError("Não foi possível conectar ao servidor. Tente novamente.");
          return;
        }
        const { from } = await searchParams;
        push(safeRedirectPath(from));
        refresh();
      },
      validators: { onSubmit: loginSchema },
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
            <h2>Entrar</h2>
          </CardTitle>
          <CardDescription>Acesse o painel operacional da Qolmeia.</CardDescription>
        </CardHeader>
        <form className="flex flex-col gap-(--card-spacing)" noValidate onSubmit={handleSubmit}>
          <CardContent>
            <FieldGroup>
              <form.Field name="email">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
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
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                        <Link
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          href="/recover"
                        >
                          Esqueci minha senha
                        </Link>
                      </div>
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
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  className="w-full"
                  disabled={!canSubmit || isSubmitting}
                  size="lg"
                  type="submit"
                >
                  {isSubmitting ? "Entrando…" : "Entrar"}
                </Button>
              )}
            </form.Subscribe>
            {registerPrompt}
          </CardFooter>
        </form>
      </Card>
    );
  };

  return Form;
};

const LoginForm = createLoginForm({
  showError: (message) => {
    toast.error(message);
  },
  signInEmail: async (credentials) => {
    const { error } = await authClient.signIn.email(credentials);
    return { error };
  },
  useAppRouter: useRouter,
});

export { createLoginForm, LoginForm };
export type { LoginDependencies };
