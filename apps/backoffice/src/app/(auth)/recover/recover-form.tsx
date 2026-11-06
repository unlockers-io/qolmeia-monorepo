"use client";

import { authClient, authRequest } from "@repo/app-shell/auth-client";
import { EmailField } from "@repo/app-shell/auth-fields";
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
import { useState } from "react";
import { toast } from "sonner";

import { recoverSchema } from "@/lib/form-schemas";

const RecoverForm = () => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "" },
    listeners: {
      onChange: () => {
        setSubmitError(null);
      },
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const { error } = await authRequest(
        () =>
          authClient.requestPasswordReset({ email: value.email, redirectTo: "/reset-password" }),
        "Não foi possível enviar o link.",
      );

      if (error !== null) {
        setSubmitError(error);

        return;
      }

      toast.success("Enviamos um link para seu e-mail.");
    },
    onSubmitInvalid: ({ formApi }) => {
      focusFirstInvalidField(formApi.formId);
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
        id={form.formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <CardContent>
          <FieldGroup>
            <FormAlert message={submitError} />
            <form.Field name="email">{(field) => <EmailField field={field} />}</form.Field>
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
