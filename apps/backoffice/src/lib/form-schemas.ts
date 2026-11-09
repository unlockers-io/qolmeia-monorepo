import { emailSchema, newPasswordSchema } from "@repo/app-shell/auth-schemas";
import { maxLength, maxLengthMessage } from "@repo/app-shell/form-limits";
import { EMAIL_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "@repo/worker-api/contracts";
import { z } from "zod";

export const NAME_MIN_LENGTH = 3;

export const NAME_MAX_LENGTH = 32;

const passwordsMatch = {
  message: "As senhas não conferem.",
  path: ["confirmPassword"],
};

export const registerSchema = z
  .object({
    confirmPassword: newPasswordSchema,
    email: emailSchema,
    name: z
      .string()
      .min(NAME_MIN_LENGTH, `O nome deve ter pelo menos ${NAME_MIN_LENGTH} caracteres`)
      .max(NAME_MAX_LENGTH, `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres`),
    password: newPasswordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const recoverSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: newPasswordSchema,
    password: newPasswordSchema,
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const inviteCustomerSchema = z.object({
  email: emailSchema.max(EMAIL_MAX_LENGTH, maxLengthMessage(EMAIL_MAX_LENGTH)),
});

export const memberNameSchema = z.object({ displayName: maxLength(MEMBER_NAME_MAX_LENGTH) });
