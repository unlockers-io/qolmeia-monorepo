import { OPERATOR_ROLES, type OrgRole } from "@repo/worker-api/contracts";
import { APIError, createAuthMiddleware } from "better-auth/api";

const SIGNUP_CLOSED_MESSAGE = "Este painel já tem um operador. Peça um convite para entrar.";

type OperatorCounter = {
  orgMembership: {
    count: (args: { where: { role: { in: Array<OrgRole> } } }) => PromiseLike<number>;
  };
};

const countOperators = async (prisma: OperatorCounter): Promise<number> =>
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

export { countOperators, createSignupGuard, isSignupOpen, SIGNUP_CLOSED_MESSAGE };
export type { OperatorCounter };
