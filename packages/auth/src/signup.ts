import type { PrismaClient } from "@repo/db";
import { APIError, createAuthMiddleware } from "better-auth/api";

const OPERATOR_ROLES = ["OWNER", "STAFF"] as const;

const SIGNUP_CLOSED_MESSAGE = "Este painel já tem um operador. Peça um convite para entrar.";

const countOperators = (prisma: Pick<PrismaClient, "orgMembership">): Promise<number> =>
  prisma.orgMembership.count({ where: { role: { in: [...OPERATOR_ROLES] } } });

const isSignupOpen = (operatorCount: number): boolean => operatorCount === 0;

const createSignupGuard = (countOperatorsFn: () => Promise<number>) =>
  createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-up/email") {
      return;
    }
    if (!isSignupOpen(await countOperatorsFn())) {
      throw new APIError("FORBIDDEN", { message: SIGNUP_CLOSED_MESSAGE });
    }
  });

export { countOperators, createSignupGuard, isSignupOpen, OPERATOR_ROLES, SIGNUP_CLOSED_MESSAGE };
