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
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRef } from "react";
import { toast } from "sonner";

import { recoverSchema } from "@/lib/form-schemas";

const RecoverForm = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      try {
        const { error } = await authClient.requestPasswordReset({
          email: value.email,
          redirectTo: "/reset-password",
        });
        if (error) {
          toast.error(authErrorMessage(error, "Não foi possível enviar o link."));
          return;
        }
      } catch {
        toast.error("Não foi possível conectar ao servidor. Tente novamente.");
        return;
      }
      toast.success("Enviamos um link para seu e-mail.");
    },
    onSubmitInvalid: () => {
      focusFirstInvalidField(formRef.current);
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: recoverSchema },
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
          <h1>Recuperar senha</h1>
        </CardTitle>
        <CardDescription>
          Informe o e-mail cadastrado para receber o link de redefinição.
        </CardDescription>
      </CardHeader>
      <ClientReadyForm
        className="flex flex-col gap-(--card-spacing)"
        noValidate
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <CardContent>
          <FieldGroup>
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
                {isSubmitting ? "Enviando…" : "Enviar link"}
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

export { RecoverForm };
