"use client";

import { createBetterAuthClient } from "@repo/auth/client";
import { magicLinkClient, organizationClient, usernameClient } from "better-auth/client/plugins";

import { PASSWORD_TOO_SHORT } from "./auth-schemas";

const authClient = createBetterAuthClient({
  plugins: [usernameClient(), magicLinkClient(), organizationClient()],
});

type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

const AUTH_ERROR_MESSAGES = {
  EMAIL_NOT_VERIFIED: "Este e-mail ainda não foi verificado. Acabamos de enviar um novo link.",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
    "Confirme seu e-mail antes de aceitar o convite.",
  INVALID_EMAIL: "E-mail inválido.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_TOKEN: "Link inválido ou expirado. Solicite um novo.",
  INVITATION_NOT_FOUND:
    "Este convite não existe, já foi usado ou expirou. Peça um novo à equipe Qolmeia.",
  PASSWORD_TOO_LONG: "A senha é longa demais.",
  PASSWORD_TOO_SHORT,
  TOKEN_EXPIRED: "Link expirado. Solicite um novo.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION:
    "Este convite foi enviado para outro e-mail. Saia e entre com o e-mail convidado.",
} satisfies Partial<Record<AuthErrorCode, string>>;

const authErrorMessages = new Map<string, string>(Object.entries(AUTH_ERROR_MESSAGES));

const TOO_MANY_REQUESTS = 429;

type AuthError = { code?: string; status?: number };

const authErrorMessage = (error: AuthError, fallback: string): string => {
  if (error.status === TOO_MANY_REQUESTS) {
    return "Muitas tentativas. Aguarde um instante e tente de novo.";
  }

  return (error.code === undefined ? undefined : authErrorMessages.get(error.code)) ?? fallback;
};

type AuthOutcome<Result> = { error: null; result: Result } | { error: string; status?: number };

/** Runs a Better Auth call and turns its error, or an unreachable server, into a pt-BR message. */
const authRequest = async <Result extends { error: AuthError | null }>(
  call: () => Promise<Result>,
  fallback: string,
): Promise<AuthOutcome<Result>> => {
  try {
    const result = await call();

    return result.error === null
      ? { error: null, result }
      : { error: authErrorMessage(result.error, fallback), status: result.error.status };
  } catch {
    return { error: "Não foi possível conectar ao servidor. Tente novamente." };
  }
};

export { authClient, authErrorMessage, authRequest };

export type { AuthError };
