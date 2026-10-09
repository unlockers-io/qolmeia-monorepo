import { envAuthConfig } from "@repo/auth/env-config";
import { createAuth } from "@repo/auth/server";
import { prisma } from "@repo/db";
import { isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

type Auth = ReturnType<typeof createAuth>;

let cachedAuth: Auth | undefined;

const getAuth = (): Auth => {
  if (!cachedAuth) {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (secret === undefined || secret.length < 32) {
      throw new Error(
        "BETTER_AUTH_SECRET must be set to at least 32 characters (generate with: openssl rand -base64 32)",
      );
    }
    cachedAuth = createAuth({
      ...envAuthConfig(),
      extraPlugins: [nextCookies()],
      prisma,
      resendApiKey: process.env.RESEND_API_KEY,
      secret,
    });
  }
  return cachedAuth;
};

type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

type GetSession = (headers: Headers) => Promise<AuthSession | null>;

const UNAUTHORIZED = 401;

const getSessionFromAuth: GetSession = (headers) => getAuth().api.getSession({ headers });

const readSession = async (
  headers: Headers,
  getSession: GetSession = getSessionFromAuth,
): Promise<AuthSession | null> => {
  try {
    return await getSession(headers);
  } catch (error) {
    if (isAPIError(error) && error.statusCode === UNAUTHORIZED) {
      return null;
    }
    throw error;
  }
};

export { getAuth, readSession };
export type { Auth, AuthSession, GetSession };
