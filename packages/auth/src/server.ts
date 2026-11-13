import { isLoopbackHost } from "@better-auth/core/utils/host";
import { log } from "@repo/observability";
import { sendTransactionalEmail } from "@repo/transactional";
import type { Transport } from "@repo/transactional/transport";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { username } from "better-auth/plugins/username";
import type { BetterAuthPlugin } from "better-auth/types";

import { CLIENT_IP_HEADER } from "./client-ip";
import { LINK_LIFETIME_SECONDS } from "./link-lifetimes";
import { customerInvitations, organizationOptions } from "./organization";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";
import { safeRedirectPath } from "./redirect-path";
import { AUTH_COOKIE_PREFIX } from "./session-cookie";
import { countOperators, createSignupGuard, type OperatorCounter } from "./signup";

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

type CustomerInvitationEmail = {
  acceptUrl: string;
  companyName: string;
  email: string;
  transport: Transport;
};

const sendCustomerInvitation = async ({
  acceptUrl,
  companyName,
  email,
  transport,
}: CustomerInvitationEmail): Promise<boolean> => {
  const result = await sendTransactionalEmail(
    {
      acceptUrl,
      companyName,
      expiresInSeconds: LINK_LIFETIME_SECONDS.invitation,
      type: "invitation",
      userEmail: email,
    },
    transport,
  );

  if (!result.success) {
    log.error({ error: result.error, message: "auth: failed to send invitation email" });
  }

  return result.success;
};

type AuthConfig = {
  allowedHosts: Array<string>;
  extraPlugins?: Array<BetterAuthPlugin>;
  fallbackBaseURL: string;
  prisma: OperatorCounter;
  rateLimitEnabled?: boolean;
  secret: string;
  transport: Transport;
  trustedOrigins?: Array<string>;
  useSecureCookies?: boolean;
};

export const createAuth = (config: AuthConfig) => {
  const {
    allowedHosts,
    extraPlugins = [],
    fallbackBaseURL,
    prisma,
    rateLimitEnabled = false,
    secret,
    transport,
    trustedOrigins = [],
    useSecureCookies = false,
  } = config;

  return betterAuth({
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["email"],
      },
    },

    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax" as const,
      },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      useSecureCookies,
    },

    basePath: "/api/auth",

    baseURL: {
      allowedHosts,
      fallback: fallbackBaseURL,
      protocol: "auto",
    },

    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    emailAndPassword: {
      enabled: true,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      onExistingUserSignUp: async ({ user }, request) => {
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
          transport,
        );

        if (!result.success) {
          log.error({
            error: result.error,
            message: "auth: failed to send sign-up attempt email",
          });
        }
      },
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: LINK_LIFETIME_SECONDS.passwordReset,
      sendResetPassword: async ({ url, user }, request) => {
        const result = await sendTransactionalEmail(
          {
            expiresInSeconds: LINK_LIFETIME_SECONDS.passwordReset,
            resetUrl: linkOnRequestOrigin(url, request?.headers, trustedOrigins),
            type: "password-reset",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
          },
          transport,
        );

        if (!result.success) {
          throw new Error(`Failed to send password reset email: ${result.error}`);
        }
      },
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      expiresIn: LINK_LIFETIME_SECONDS.emailVerification,
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
              const callbackPath = safeRedirectPath(target.searchParams.get("callbackURL"));
              target.searchParams.set("callbackURL", `${origin}${callbackPath}`);

              return target.toString();
            } catch {
              return url;
            }
          })(),
          request?.headers,
          trustedOrigins,
        );

        const result = await sendTransactionalEmail(
          {
            expiresInSeconds: LINK_LIFETIME_SECONDS.emailVerification,
            type: "welcome",
            userEmail: user.email,
            userId: user.id,
            username: user.name,
            verificationUrl,
          },
          transport,
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
        expiresIn: LINK_LIFETIME_SECONDS.magicLink,
        sendMagicLink: async ({ email, url }, ctx) => {
          const result = await sendTransactionalEmail(
            {
              expiresInSeconds: LINK_LIFETIME_SECONDS.magicLink,
              type: "magic-link",
              url: linkOnRequestOrigin(url, ctx?.headers, trustedOrigins),
              userEmail: email,
            },
            transport,
          );

          if (!result.success) {
            throw new Error(`Failed to send magic-link email: ${result.error}`);
          }
        },
      }),
      organization(organizationOptions),
      customerInvitations(),
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
          const result = await sendTransactionalEmail(
            {
              changeUrl: linkOnRequestOrigin(url, request?.headers, trustedOrigins),
              currentEmail: user.email,
              expiresInSeconds: LINK_LIFETIME_SECONDS.emailVerification,
              newEmail,
              type: "change-email-confirmation",
              userId: user.id,
              username: user.name,
            },
            transport,
          );

          if (!result.success) {
            throw new Error(`Failed to send change-email confirmation: ${result.error}`);
          }
        },
      },
    },
  });
};

export { sendCustomerInvitation };

export type Auth = ReturnType<typeof createAuth>;

export type { AuthConfig };
