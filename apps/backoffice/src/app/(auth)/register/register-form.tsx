"use client";

import { authClient, authRequest } from "@repo/app-shell/auth-client";
import { EmailField, PasswordField, TextField } from "@repo/app-shell/auth-fields";
import { PASSWORD_HINT } from "@repo/app-shell/auth-schemas";
import { loginHref, safeRedirectPath } from "@repo/auth/redirect-path";
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
import { Suspense, use, useState } from "react";
import { toast } from "sonner";

import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, registerSchema } from "@/lib/form-schemas";

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const LoginLinkFallback = () => (
  <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/login">
    Entrar
  </Link>
);

const LoginLink = ({ searchParams }: Props) => {
  const { from } = use(searchParams);

  return (
    <Link
      className="font-medium text-primary underline-offset-4 hover:underline"
      href={loginHref(from)}
    >
      Entrar
    </Link>
  );
};

const RegisterForm = ({ searchParams }: Props) => {
  const { push, refresh } = useRouter();
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", email: "", name: "", password: "" },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const { from } = await searchParams;
      const redirectTo = safeRedirectPath(from);

      const outcome = await authRequest(
        () =>
          authClient.signUp.email({
            callbackURL: redirectTo,
            email: value.email,
            name: value.name,
            password: value.password,
          }),
        "Não foi possível criar a conta.",
      );

      if (outcome.error !== null) {
        setSubmitError(outcome.error);

        return;
      }

      const token = outcome.result.data?.token ?? null;

      if (token === null || token === "") {
        setSentToEmail(value.email);

        return;
      }

      toast.success("Conta criada. Bem-vindo à Qolmeia!");
      push(redirectTo);
      refresh();
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: registerSchema },
  });

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  if (sentToEmail !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Verifique seu e-mail</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <output aria-live="polite" className="block text-sm text-muted-foreground">
            Enviamos um link de verificação para{" "}
            <span className="font-medium text-foreground">{sentToEmail}</span>. Clique nele para
            confirmar sua conta e entrar.
          </output>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Criar conta</h1>
        </CardTitle>
        <CardDescription>Cadastre-se para acessar o painel da Qolmeia.</CardDescription>
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
            <form.Field name="name">
              {(field) => (
                <TextField
                  autoComplete="name"
                  description={`De ${NAME_MIN_LENGTH} a ${NAME_MAX_LENGTH} caracteres.`}
                  field={field}
                  label="Nome"
                  type="text"
                />
              )}
            </form.Field>
            <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
            <form.Field name="password">
              {(field) => (
                <PasswordField
                  autoComplete="new-password"
                  description={PASSWORD_HINT}
                  field={field}
                  label="Senha"
                />
              )}
            </form.Field>
            <form.Field name="confirmPassword">
              {(field) => (
                <PasswordField autoComplete="new-password" field={field} label="Confirmar senha" />
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
                {isSubmitting ? "Criando conta…" : "Criar conta"}
              </Button>
            )}
          </form.Subscribe>
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Suspense fallback={<LoginLinkFallback />}>
              <LoginLink searchParams={searchParams} />
            </Suspense>
          </p>
        </CardFooter>
      </ClientReadyForm>
    </Card>
  );
};

export { RegisterForm };
