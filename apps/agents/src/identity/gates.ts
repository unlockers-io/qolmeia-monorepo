import type { Surface } from "@repo/worker-api/contracts";
import type { Context, MiddlewareHandler } from "hono";

import { resolveIdentity, type Identity } from "#/identity/identity";
import { createWorkerAuth } from "#/lib/auth";
import type { DbVariables } from "#/lib/db";

type IdentityEnv = { Bindings: Env; Variables: DbVariables & { session: Identity } };

type GateOptions = {
  surfaces: ReadonlyArray<Surface>;
  tenant?: (c: Context<IdentityEnv>) => string | undefined;
};

const UNRESOLVED_STATUS = { forbidden: 403, "signed-out": 401, unavailable: 503 } as const;

/** The only writer of the `session` variable, so IdentityEnv can declare it non-optional. */
const identityGate =
  ({ surfaces, tenant }: GateOptions): MiddlewareHandler<IdentityEnv> =>
  async (c, next) => {
    const result = await resolveIdentity(
      createWorkerAuth(c.env, c.var.db),
      c.var.db,
      c.req.raw.headers,
      surfaces,
    );
    if (result.kind !== "signed-in") {
      return c.body(null, UNRESOLVED_STATUS[result.kind]);
    }
    if (tenant !== undefined && tenant(c) !== result.identity.companyId) {
      return c.body(null, 403);
    }
    c.set("session", result.identity);
    return next();
  };

const requireOperator = identityGate({ surfaces: ["operator"] });

const requireCustomer = identityGate({ surfaces: ["customer"] });

/**
 * Any member, on either surface. An account with an Operator membership acts through it, since
 * it already reads every Company (ADR 0005).
 */
const requireMember = identityGate({ surfaces: ["operator", "customer"] });

/**
 * For /agents/<name>/<companyId>/… and /api/teams/<companyId>/…: segment 3 names a tenant, which
 * must be the Customer's own Company (ADR 0001). A shorter path names none and is refused.
 */
const requireCustomerOfPathTenant = identityGate({
  surfaces: ["customer"],
  tenant: (c) => c.req.path.split("/")[3],
});

export { requireCustomer, requireCustomerOfPathTenant, requireMember, requireOperator };
export type { IdentityEnv };
