import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@repo/auth/password";
import { z } from "zod";

const emailSchema = z.email("E-mail inválido");

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha"),
});

const magicLinkSchema = loginSchema.extend({ password: z.string() });

const PASSWORD_HINT = `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;

const PASSWORD_TOO_SHORT = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;

const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT)
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`);

export {
  emailSchema,
  loginSchema,
  magicLinkSchema,
  newPasswordSchema,
  PASSWORD_HINT,
  PASSWORD_TOO_SHORT,
};
