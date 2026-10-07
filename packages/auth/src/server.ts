import { isLoopbackHost } from "@better-auth/core/utils/host";
import type { PrismaClient } from "@repo/db";
import { log } from "@repo/observability";
import type { MailerConfig } from "@repo/transactional";
import { sendTransactionalEmail } from "@repo/transactional";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins/magic-link";
import { username } from "better-auth/plugins/username";
import type { BetterAuthPlugin } from "better-auth/types";

import { countOperators, createSignupGuard } from "./signup";

const CALLBACK_FALLBACK_PATH = "/";

const CALLBACK_ANCHOR_ORIGIN = "https://qolmeia.invalid";

export const safeCallbackPath = (value: string | null): string => {
  if (value === null || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return CALLBACK_FALLBACK_PATH;
  }
  try {
    if (new URL(value, CALLBACK_ANCHOR_ORIGIN).origin !== CALLBACK_ANCHOR_ORIGIN) {
      return CALLBACK_FALLBACK_PATH;
    }
  } catch {
    return CALLBACK_FALLBACK_PATH;
  }
  return value;
};

const isLinkOrigin = (origin: URL, trustedOrigins: ReadonlyArray<string>): boolean =>
  trustedOrigins.includes(origin.origin) || isLoopbackHost(origin.host);

export const linkOnRequestOrigin = (
  url: string,
  headers: Headers | undefined,
  trustedOrigins: ReadonlyArray<string>,
): string => {
  const origin = headers?.get("origin");
  if (origin === undefined || origin === null || !URL.canParse(origin) || !URL.canParse(url)) {
    return url;
  }
  const requestOrigin = new URL(origin);
  if (!isLinkOrigin(requestOrigin, trustedOrigins)) {
    return url;
  }
  const link = new URL(url);
  return new URL(`${link.pathname}${link.search}`, requestOrigin.origin).toString();
};

type AuthConfig = {
  allowedHosts: Array<string>;
  extraPlugins?: Array<BetterAuthPlugin>;
  fromEmail?: string;
  prisma: PrismaClient;
  rateLimitEnabled?: boolean;
  resendApiKey?: string;
  secret: string;
  trustedOrigins?: Array<string>;
  useSecureCookies?: boolean;
};

export const createAuth = (config: AuthConfig) => {
  const {
    allowedHosts,
    extraPlugins = [],
    fromEmail = "noreply@email.qolmeia.com",
    prisma,
    rateLimitEnabled = false,
    resendApiKey,
    secret,
    trustedOrigins = [],
    useSecureCookies = false,
  } = config;

  const mailer: MailerConfig | null =
    resendApiKey !== undefined && resendApiKey !== ""
      ? { apiKey: resendApiKey, from: fromEmail }
      : null;

  return betterAuth({
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email"],
      },
    },

    advanced: {
      cookiePrefix: "qolmeia",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax" as const,
      },
      useSecureCookies,
    },

    basePath: "/api/auth",

    baseURL: {
      allowedHosts,
      fallback: "http://localhost:4000",
      protocol: "auto",
    },

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      onExistingUserSignUp: mailer
        ? async ({ user }, request) => {
            const origin = request?.headers.get("origin") ?? "";
            const result = await sendTransactionalEmail(
              {
                resetPasswordUrl: `${origin}/recover`,
                signInUrl: `${origin}/login`,
                type: "sign-up-attempt",
                userEmail: user.email,
                userId: user.id,
                username: user.name,
              },
              mailer,
            );
            if (!result.success) {
              log.error({
                error: result.error,
                message: "auth: failed to send sign-up attempt email",
              });
            }
          }
        : undefined,
      requireEmailVerification: Boolean(mailer),
      sendResetPassword: async ({ url, user }, request) => {
        const resetUrl = linkOnRequestOrigin(url, request?.headers, trustedOrigins);
        if (!mailer) {
          log.info({
            message: "auth: password-reset link (no Resend key)",
            url: resetUrl,
            userEmail: user.email,
          });
          return;
        }
        const result = await sendTransactionalEmail(
          {
            resetUrl,
            type: "password-reset",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
          },
          mailer,
        );
        if (!result.success) {
          throw new Error(`Failed to send password reset email: ${result.error}`);
        }
      },
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ url, user }, request) => {
        const origin = request?.headers.get("origin");
        const verificationUrl = linkOnRequestOrigin(
          (() => {
            if (origin === undefined || origin === null || origin === "") {
              return url;
            }
            try {
              const target = new URL(url);
              const callbackPath = safeCallbackPath(target.searchParams.get("callbackURL"));
              target.searchParams.set("callbackURL", `${origin}${callbackPath}`);
              return target.toString();
            } catch {
              return url;
            }
          })(),
          request?.headers,
          trustedOrigins,
        );
        if (!mailer) {
          log.info({
            message: "auth: verification link (no Resend key)",
            url: verificationUrl,
            userEmail: user.email,
          });
          return;
        }
        const result = await sendTransactionalEmail(
          {
            type: "welcome",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
            verificationUrl,
          },
          mailer,
        );
        if (!result.success) {
          throw new Error(`Failed to send verification email: ${result.error}`);
        }
      },
    },

    hooks: {
      before: createSignupGuard(() => countOperators(prisma)),
    },

    plugins: [
      username(),
      magicLink({
        sendMagicLink: async ({ email, url }, ctx) => {
          const link = linkOnRequestOrigin(url, ctx?.headers, trustedOrigins);
          if (!mailer) {
            log.info({ message: "auth: magic-link (no Resend key)", url: link, userEmail: email });
            return;
          }
          const result = await sendTransactionalEmail(
            {
              type: "magic-link",
              url: link,
              userEmail: email,
            },
            mailer,
          );
          if (!result.success) {
            throw new Error(`Failed to send magic-link email: ${result.error}`);
          }
        },
      }),
      ...extraPlugins,
    ],

    rateLimit: {
      enabled: rateLimitEnabled,
      max: 100,
      storage: "database",
      window: 60,
    },

    secret,

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      storeSessionInDatabase: true,
      updateAge: 60 * 60 * 24, // Update session if older than 1 day
    },
    trustedOrigins,
    user: {
      additionalFields: {
        displayName: {
          defaultValue: null,
          required: false,
          type: "string",
        },
      },
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ newEmail, url, user }, request) => {
          if (!mailer) {
            return;
          }
          const result = await sendTransactionalEmail(
            {
              changeUrl: linkOnRequestOrigin(url, request?.headers, trustedOrigins),
              currentEmail: user.email,
              newEmail,
              type: "change-email-confirmation",
              userId: user.id,
              username: user.name,
            },
            mailer,
          );
          if (!result.success) {
            throw new Error(`Failed to send change-email confirmation: ${result.error}`);
          }
        },
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;
export type { AuthConfig };
