import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

const passwordsMatch = {
  message: "As senhas não conferem.",
  path: ["confirmPassword"],
};

export const registerSchema = z
  .object({
    confirmPassword: z.string().min(12, "A senha deve ter pelo menos 12 caracteres"),
    email: z.email("E-mail inválido"),
    name: z
      .string()
      .min(3, "O nome deve ter pelo menos 3 caracteres")
      .max(32, "O nome deve ter no máximo 32 caracteres"),
    password: z.string().min(12, "A senha deve ter pelo menos 12 caracteres"),
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const recoverSchema = z.object({
  email: z.email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(12, "A senha deve ter pelo menos 12 caracteres"),
    password: z.string().min(12, "A senha deve ter pelo menos 12 caracteres"),
  })
  .refine((value) => value.password === value.confirmPassword, passwordsMatch);

export const inviteCustomerSchema = z.object({
  email: z.email("E-mail inválido"),
});
