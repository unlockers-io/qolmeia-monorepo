"use client";

import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { FormFieldError } from "@repo/ui/compositions/form-field-error";
import type { ComponentProps } from "react";

type StringField = {
  handleBlur: () => void;
  handleChange: (value: string) => void;
  name: string;
  state: { meta: { errors: Array<unknown>; isValid: boolean }; value: string };
};

type TextFieldProps = Pick<ComponentProps<"input">, "autoComplete" | "placeholder" | "type"> & {
  description?: string;
  field: StringField;
  label: string;
};

const TextField = ({
  autoComplete,
  description,
  field,
  label,
  placeholder,
  type,
}: TextFieldProps) => {
  const isInvalid = !field.state.meta.isValid;
  const descriptionId = `${field.name}-description`;
  const errorId = `${field.name}-error`;

  const describedBy = [
    description === undefined ? null : descriptionId,
    isInvalid ? errorId : null,
  ].filter((id) => id !== null);

  return (
    <Field data-invalid={isInvalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        aria-describedby={describedBy.length === 0 ? undefined : describedBy.join(" ")}
        aria-invalid={isInvalid}
        autoComplete={autoComplete}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        placeholder={placeholder}
        type={type}
        value={field.state.value}
      />
      {description !== undefined && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {isInvalid && <FormFieldError errors={field.state.meta.errors} id={errorId} />}
    </Field>
  );
};

const EmailField = ({ field }: { field: StringField }) => (
  <TextField
    autoComplete="email"
    field={field}
    label="E-mail"
    placeholder="voce@empresa.com"
    type="email"
  />
);

type PasswordFieldProps = Pick<TextFieldProps, "description" | "field" | "label"> & {
  autoComplete: "current-password" | "new-password";
};

const PasswordField = (props: PasswordFieldProps) => <TextField {...props} type="password" />;

export { EmailField, PasswordField, TextField };
