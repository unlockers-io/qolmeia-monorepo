import type { OrgRole } from "@repo/worker-api/contracts";
import { makeSignature } from "better-auth/crypto";
import { env, exports } from "cloudflare:workers";

import { createWorkerAuth } from "#/lib/auth";
import { withDb } from "#/lib/db";

type Membership = { orgId: string; role: OrgRole };

type Persona = Membership & { userId?: string };

const HOUR_MS = 60 * 60 * 1000;

/**
 * Gives a user (created on first use) the memberships, oldest first, and a live session.
 * Returns the Cookie header the browser would send.
 */
const signIn = (
  memberships: ReadonlyArray<Membership>,
  userId: string = crypto.randomUUID(),
): Promise<string> =>
  withDb(env, async (db) => {
    await db.user.upsert({
      create: { email: `${userId}@qolmeia.test`, emailVerified: true, id: userId, name: "Teste" },
      update: {},
      where: { id: userId },
    });
    for (const [index, { orgId, role }] of memberships.entries()) {
      await db.organization.upsert({
        create: { id: orgId, name: `Org ${orgId}`, slug: orgId },
        update: {},
        where: { id: orgId },
      });
      await db.orgMembership.upsert({
        create: { createdAt: new Date(Date.UTC(2026, 0, index + 1)), orgId, role, userId },
        update: { role },
        where: { userId_orgId: { orgId, userId } },
      });
    }
    const token = crypto.randomUUID();
    await db.session.create({
      data: { expiresAt: new Date(Date.now() + HOUR_MS), token, userId },
    });
    const { authCookies, secret } = await createWorkerAuth(env, db).$context;
    return `${authCookies.sessionToken.name}=${token}.${await makeSignature(token, secret)}`;
  });

const signInAs = ({ orgId, role, userId }: Persona): Promise<string> =>
  signIn([{ orgId, role }], userId);

const fetchWithCookie = (cookie: string, url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (cookie !== "") {
    headers.set("cookie", cookie);
  }
  return exports.default.fetch(url, { ...init, headers });
};

export { fetchWithCookie, signIn, signInAs };
export type { Persona };
