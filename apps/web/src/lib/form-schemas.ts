import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const magicLinkSchema = loginSchema.extend({ password: z.string() });

const maxLength = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max.toLocaleString("pt-BR")} caracteres.`);

export const hireSchema = z.object({ displayName: maxLength(80) });

export const promptSchema = z.object({ prompt: maxLength(20_000) });

export const BRIEF_MAX_LENGTH = {
  audience: 500,
  industry: 200,
  palette: 200,
  primaryGoal: 500,
  references: 500,
  voice: 200,
} as const;

export const companyBriefSchema = z.object({
  audience: maxLength(BRIEF_MAX_LENGTH.audience),
  industry: maxLength(BRIEF_MAX_LENGTH.industry),
  palette: maxLength(BRIEF_MAX_LENGTH.palette),
  primaryGoal: maxLength(BRIEF_MAX_LENGTH.primaryGoal),
  references: maxLength(BRIEF_MAX_LENGTH.references),
  voice: maxLength(BRIEF_MAX_LENGTH.voice),
});

export const confirmTeamSchema = z.object({
  templateIds: z.array(z.string()).min(1, "Escolha pelo menos um especialista."),
});
