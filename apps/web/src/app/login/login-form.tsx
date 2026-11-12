"use client";

import { authClient, authRequest, type AuthError } from "@repo/app-shell/auth-client";
import { EmailField, PasswordField } from "@repo/app-shell/auth-fields";
import { loginSchema, magicLinkSchema } from "@repo/app-shell/auth-schemas";
import { redirectFrom, withFrom } from "@repo/auth/redirect-path";
import { Button } from "@repo/ui/components/button";
import { FieldGroup } from "@repo/ui/components/field";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginFormDependencies = {
  redirectTo: () => string;
  router: Pick<ReturnType<typeof useRouter>, "push" | "refresh">;
  sendMagicLink: (input: {
    callbackURL: string;
    email: string;
  }) => Promise<{ error: AuthError | null }>;
  signInEmail: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: AuthError | null }>;
};

type SubmitLabelState = {
  isMagicLink: boolean;
  isSubmitting: boolean;
};

const getSubmitLabel = ({ isMagicLink, isSubmitting }: SubmitLabelState) => {
  if (isMagicLink) {
    return isSubmitting ? "Enviando…" : "Enviar link mágico";
  }

  return isSubmitting ? "Entrando…" : "Entrar";
};

const DEFAULT_DEPENDENCIES: Omit<LoginFormDependencies, "router"> = {
  redirectTo: () => redirectFrom(window.location.search),
  sendMagicLink: async (input) => {
    const { error } = await authClient.signIn.magicLink(input);

    return { error };
  },
  signInEmail: async (credentials) => {
    const { error } = await authClient.signIn.email(credentials);

    return { error };
  },
};

const LoginFormView = ({ dependencies }: { dependencies: LoginFormDependencies }) => {
  const { redirectTo, router, sendMagicLink, signInEmail } = dependencies;
  const { push, refresh } = router;
  const [loginMethod, setLoginMethod] = useState<"magicLink" | "password">("password");
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isMagicLink = loginMethod === "magicLink";

  const signIn = async (credentials: { email: string; password: string }) => {
    const { error } = await authRequest(
      () => signInEmail(credentials),
      "Não foi possível entrar. Verifique seu e-mail e sua senha.",
    );

    if (error !== null) {
      setSubmitError(error);

      return;
    }

    push(redirectTo());
    refresh();
  };

  const requestMagicLink = async (email: string) => {
    const callbackURL = new URL(
      withFrom("/auth/verify", redirectTo()),
      window.location.origin,
    ).toString();

    const { error } = await authRequest(
      () => sendMagicLink({ callbackURL, email }),
      "Não foi possível enviar o link. Tente novamente.",
    );

    if (error !== null) {
      setSubmitError(error);

      return;
    }

    setSent(true);
  };

  const form = useForm({
    defaultValues: { email: "", password: "" },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      if (isMagicLink) {
        await requestMagicLink(value.email);

        return;
      }

      await signIn(value);
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: isMagicLink ? magicLinkSchema : loginSchema },
  });

  const handleLoginMethodChange = () => {
    setSubmitError(null);
    setLoginMethod(isMagicLink ? "password" : "magicLink");
  };

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  };

  if (sent) {
    return (
      <div className="w-full max-w-xs">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Verifique seu e-mail</h2>
        <p className="mt-3 max-w-measure-footer text-base text-pretty text-muted-foreground sm:text-sm">
          Enviamos um link mágico para você. Abra o e-mail e clique no link para entrar.
        </p>
        <Button
          className="mt-8 w-full"
          onClick={() => {
            setSent(false);
          }}
          type="button"
          variant="outline"
        >
          Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Entrar</h2>
      <p className="mt-3 max-w-measure-footer text-base text-pretty text-muted-foreground sm:text-sm">
        {isMagicLink
          ? "Digite seu e-mail para receber um link mágico de acesso."
          : "Digite seu e-mail e sua senha para entrar."}
      </p>
      <ClientReadyForm className="mt-8" id={form.formId} noValidate onSubmit={handleSubmit}>
        <FieldGroup>
          <FormAlert message={submitError} />
          <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
          {!isMagicLink && (
            <form.Field name="password">
              {(field) => (
                <PasswordField autoComplete="current-password" field={field} label="Senha" />
              )}
            </form.Field>
          )}
        </FieldGroup>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <div className="mt-6 flex flex-col gap-3">
              <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
                {getSubmitLabel({ isMagicLink, isSubmitting })}
              </Button>
              <button
                className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                disabled={isSubmitting}
                onClick={handleLoginMethodChange}
                type="button"
              >
                {isMagicLink ? "Entrar com senha" : "Entrar com link mágico"}
              </button>
            </div>
          )}
        </form.Subscribe>
      </ClientReadyForm>
    </div>
  );
};

const LoginForm = () => {
  const router = useRouter();

  return <LoginFormView dependencies={{ ...DEFAULT_DEPENDENCIES, router }} />;
};

export { LoginForm, LoginFormView };

export type { LoginFormDependencies };
