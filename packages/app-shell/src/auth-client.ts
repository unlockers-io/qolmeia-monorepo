"use client";

import { createBetterAuthClient } from "@repo/auth/client";
import { magicLinkClient, usernameClient } from "better-auth/client/plugins";

const authUrl = process.env.NEXT_PUBLIC_AUTH_URL;

const authClient = createBetterAuthClient({
  baseURL: authUrl !== undefined && authUrl !== "" ? `${authUrl}/api/auth` : "",
  plugins: [usernameClient(), magicLinkClient()],
});

type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

const AUTH_ERROR_MESSAGES = {
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar.",
  INVALID_EMAIL: "E-mail inválido.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_TOKEN: "Link inválido ou expirado. Solicite um novo.",
  PASSWORD_TOO_LONG: "A senha é longa demais.",
  PASSWORD_TOO_SHORT: "A senha deve ter pelo menos 12 caracteres.",
  TOKEN_EXPIRED: "Link expirado. Solicite um novo.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail.",
} satisfies Partial<Record<AuthErrorCode, string>>;

const authErrorMessages = new Map<string, string>(Object.entries(AUTH_ERROR_MESSAGES));

const TOO_MANY_REQUESTS = 429;

const authErrorMessage = (error: { code?: string; status?: number }, fallback: string): string => {
  if (error.status === TOO_MANY_REQUESTS) {
    return "Muitas tentativas. Aguarde um instante e tente de novo.";
  }
  return (error.code === undefined ? undefined : authErrorMessages.get(error.code)) ?? fallback;
};

export { authClient, authErrorMessage };
