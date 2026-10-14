import { log } from "@repo/observability";
import {
  activeMembership,
  type MeOrg,
  type MeResponse,
  type MeUser,
  type OrgRole,
  type Surface,
} from "@repo/worker-api/contracts";
import { isAPIError } from "better-auth/api";

import type { WorkerAuth } from "#/lib/auth";
import type { Db } from "#/lib/db";

type Identity = { companyId: string; role: OrgRole; userId: string };

type Unresolved = { kind: "signed-out" } | { kind: "unavailable" };

type IdentityResult =
  | { identity: Identity; kind: "signed-in" }
  | { kind: "forbidden" }
  | Unresolved;

type MeResult = { kind: "signed-in"; me: MeResponse } | Unresolved;

const readUser = async (
  auth: WorkerAuth,
  headers: Headers,
): Promise<{ kind: "signed-in"; user: MeUser } | Unresolved> => {
  try {
    const session = await auth.api.getSession({ headers });
    if (session === null) {
      return { kind: "signed-out" };
    }
    const { user } = session;
    return {
      kind: "signed-in",
      user: {
        displayName: user.displayName ?? null,
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.id,
        image: user.image ?? null,
        name: user.name,
        username: user.username ?? null,
      },
    };
  } catch (error) {
    if (isAPIError(error) && error.statusCode === 401) {
      return { kind: "signed-out" };
    }
    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "identity.session.unavailable",
    });
    return { kind: "unavailable" };
  }
};

const readOrgs = async (db: Db, userId: string): Promise<ReadonlyArray<MeOrg> | null> => {
  try {
    const memberships = await db.orgMembership.findMany({
      orderBy: { createdAt: "asc" },
      select: { org: { select: { id: true, name: true, slug: true } }, role: true },
      where: { userId },
    });
    return memberships.map(({ org, role }) => ({
      id: org.id,
      name: org.name,
      role,
      slug: org.slug,
    }));
  } catch (error) {
    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "identity.memberships.unavailable",
    });
    return null;
  }
};

const readMe = async (auth: WorkerAuth, db: Db, headers: Headers): Promise<MeResult> => {
  const session = await readUser(auth, headers);
  if (session.kind !== "signed-in") {
    return session;
  }
  const orgs = await readOrgs(db, session.user.id);
  return orgs === null
    ? { kind: "unavailable" }
    : { kind: "signed-in", me: { orgs, user: session.user } };
};

/** Acts through the caller's membership on the first of `surfaces` it has one on. */
const resolveIdentity = async (
  auth: WorkerAuth,
  db: Db,
  headers: Headers,
  surfaces: ReadonlyArray<Surface>,
): Promise<IdentityResult> => {
  const result = await readMe(auth, db, headers);
  if (result.kind !== "signed-in") {
    return result;
  }
  const [org] = surfaces.flatMap((surface) => activeMembership(result.me.orgs, surface) ?? []);
  return org === undefined
    ? { kind: "forbidden" }
    : {
        identity: { companyId: org.id, role: org.role, userId: result.me.user.id },
        kind: "signed-in",
      };
};

export { readMe, resolveIdentity };
export type { Identity, IdentityResult };
