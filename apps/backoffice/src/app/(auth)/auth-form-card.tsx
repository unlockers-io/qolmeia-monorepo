"use client";

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
import type { ReactNode } from "react";

type AuthFormCardProps = {
  children: ReactNode;
  description: ReactNode;
  error: string | null;
  footer: ReactNode;
  formId: string;
  isSubmitting: boolean;
  onSubmit: () => Promise<void>;
  pendingLabel: string;
  submitLabel: string;
  title: string;
};

const AuthFormCard = ({
  children,
  description,
  error,
  footer,
  formId,
  isSubmitting,
  onSubmit,
  pendingLabel,
  submitLabel,
  title,
}: AuthFormCardProps) => {
  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void onSubmit();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <ClientReadyForm
        className="flex flex-col gap-(--card-spacing)"
        id={formId}
        noValidate
        onSubmit={handleSubmit}
      >
        <CardContent>
          <FieldGroup>
            <FormAlert message={error} />
            {children}
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
            {isSubmitting ? pendingLabel : submitLabel}
          </Button>
          {footer}
        </CardFooter>
      </ClientReadyForm>
    </Card>
  );
};

export { AuthFormCard };
