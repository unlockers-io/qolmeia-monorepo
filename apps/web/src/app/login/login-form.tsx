"use client";

import { authClient, authErrorMessage } from "@repo/app-shell/auth-client";
import { Button } from "@repo/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { loginSchema, magicLinkSchema } from "@/lib/form-schemas";

type LoginFormDependencies = {
  router: Pick<ReturnType<typeof useRouter>, "push" | "refresh">;
  sendMagicLink: (input: {
    callbackURL: string;
    email: string;
  }) => Promise<{ error: { code?: string; status?: number } | null }>;
  showError: (message: string) => void;
  signInEmail: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ error: { code?: string; status?: number } | null }>;
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
  sendMagicLink: async (input) => {
    const { error } = await authClient.signIn.magicLink(input);
    return { error };
  },
  showError: (message) => {
    toast.error(message);
  },
  signInEmail: async (credentials) => {
    const { error } = await authClient.signIn.email(credentials);
    return { error };
  },
};

const LoginFormView = ({ dependencies }: { dependencies: LoginFormDependencies }) => {
  const { router, sendMagicLink, showError, signInEmail } = dependencies;
  const { push, refresh } = router;
  const [loginMethod, setLoginMethod] = useState<"magicLink" | "password">("password");
  const [sent, setSent] = useState(false);
  const isMagicLink = loginMethod === "magicLink";

  const signIn = async (credentials: { email: string; password: string }) => {
    try {
      const { error } = await signInEmail(credentials);
      if (error) {
        showError(
          authErrorMessage(error, "Não foi possível entrar. Verifique seu e-mail e sua senha."),
        );
        return;
      }
    } catch {
      showError("Não foi possível conectar ao servidor. Tente novamente.");
      return;
    }
    push("/");
    refresh();
  };

  const requestMagicLink = async (email: string) => {
    const callbackURL = `${window.location.origin}/auth/verify`;
    try {
      const { error } = await sendMagicLink({ callbackURL, email });
      if (error) {
        showError(authErrorMessage(error, "Não foi possível enviar o link. Tente novamente."));
        return;
      }
      setSent(true);
    } catch {
      showError("Não foi possível conectar ao servidor. Tente novamente.");
    }
  };

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      if (isMagicLink) {
        await requestMagicLink(value.email);
        return;
      }
      await signIn(value);
    },
    validators: { onSubmit: isMagicLink ? magicLinkSchema : loginSchema },
  });

  const handleLoginMethodChange = () => {
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
        <p className="mt-3 max-w-(--container-measure-footer) text-base text-pretty text-muted-foreground sm:text-sm">
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
      <p className="mt-3 max-w-(--container-measure-footer) text-base text-pretty text-muted-foreground sm:text-sm">
        {isMagicLink
          ? "Digite seu e-mail para receber um link mágico de acesso."
          : "Digite seu e-mail e sua senha para entrar."}
      </p>
      <ClientReadyForm className="mt-8" noValidate onSubmit={handleSubmit}>
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
                    <FormFieldError errors={field.state.meta.errors} id={`${field.name}-error`} />
                  )}
                </Field>
              );
            }}
          </form.Field>

          {!isMagicLink && (
            <form.Field name="password">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
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
                      <FormFieldError errors={field.state.meta.errors} id={`${field.name}-error`} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
          )}
        </FieldGroup>
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <div className="mt-6 flex flex-col gap-3">
              <Button
                className="w-full"
                disabled={(!isMagicLink && !canSubmit) || isSubmitting}
                size="lg"
                type="submit"
              >
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
