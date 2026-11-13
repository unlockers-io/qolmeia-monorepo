import { PASSWORD_LENGTH } from "@repo/auth/policy";
import { z } from "zod";

const emailSchema = z.email("E-mail inválido");

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha"),
});

const magicLinkSchema = loginSchema.extend({ password: z.string() });

const PASSWORD_HINT = `Pelo menos ${PASSWORD_LENGTH.min} caracteres.`;

const PASSWORD_TOO_SHORT = `A senha deve ter pelo menos ${PASSWORD_LENGTH.min} caracteres.`;

const newPasswordSchema = z
  .string()
  .min(PASSWORD_LENGTH.min, PASSWORD_TOO_SHORT)
  .max(PASSWORD_LENGTH.max, `A senha deve ter no máximo ${PASSWORD_LENGTH.max} caracteres`);

export {
  emailSchema,
  loginSchema,
  magicLinkSchema,
  newPasswordSchema,
  PASSWORD_HINT,
  PASSWORD_TOO_SHORT,
};
