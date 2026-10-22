import type { CustomerInvitationResponse, MeResponse } from "@repo/worker-api/contracts";
import { beforeEach, describe, expect, it } from "vitest";

import { db, seedCompany } from "#/__tests__/fixtures";
import { fetchWithCookie, signIn, signInAs } from "#/__tests__/sign-in";

const COMPANY_ID = "co_invite_test";
const OTHER_COMPANY_ID = "co_invite_other";
const QOLMEIA_ORG_ID = "org_qolmeia_invite";
const WEB_ORIGIN = "http://127.0.0.1:3001";

const post = (cookie: string, path: string, body: Record<string, string>) =>
  fetchWithCookie(cookie, `https://agents.test${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: WEB_ORIGIN },
    method: "POST",
  });

const statusOf = async (pending: Promise<Response>): Promise<number> => {
  const res = await pending;

  return res.status;
};

const invite = (cookie: string, email: string, companyId = COMPANY_ID) =>
  post(cookie, `/api/backoffice/companies/${companyId}/invitations`, { email });

const accept = (cookie: string, invitationId: string) =>
  post(cookie, "/api/auth/organization/accept-invitation", { invitationId });

const invitedId = async (pending: Promise<Response>): Promise<string> => {
  const res = await pending;
  const body = await res.json<CustomerInvitationResponse>();

  return body.invitation.id;
};

const membershipCount = (orgId: string) =>
  db((client) => client.orgMembership.count({ where: { orgId } }));

const emailOf = (userId: string) => `${userId}@qolmeia.test`;

let operator = "";

beforeEach(async () => {
  for (const { id, name } of [
    { id: COMPANY_ID, name: "Padaria Nova" },
    { id: OTHER_COMPANY_ID, name: "Outra" },
  ]) {
    await db((client) => client.organization.create({ data: { id, name, slug: id } }));
    await seedCompany({ id, name, status: "onboarding" });
  }

  operator = await signIn([{ orgId: QOLMEIA_ORG_ID, role: "OWNER" }], "operator-1");
});

describe("POST /api/backoffice/companies/:companyId/invitations", () => {
  it("creates a pending CUSTOMER invitation and records it", async () => {
    const res = await invite(operator, "Cliente@Example.com");

    expect(res.status).toBe(201);
    const { invitation } = await res.json<CustomerInvitationResponse>();
    expect(invitation.email).toBe("cliente@example.com");
    expect(invitation.expiresAt).toBeGreaterThan(Date.now());

    const [stored, activity] = await db((client) =>
      Promise.all([
        client.invitation.findUnique({ where: { id: invitation.id } }),
        client.activityLog.findFirst({ where: { type: "CUSTOMER_INVITED" } }),
      ]),
    );

    expect(stored).toMatchObject({
      email: "cliente@example.com",
      inviterId: "operator-1",
      organizationId: COMPANY_ID,
      role: "CUSTOMER",
      status: "pending",
    });
    expect(activity).toMatchObject({
      actorId: "operator-1",
      companyId: COMPANY_ID,
      refId: invitation.id,
    });
  });

  it("refuses a Customer with 403", async () => {
    const customer = await signInAs({ orgId: OTHER_COMPANY_ID, role: "CUSTOMER" });
    expect(await statusOf(invite(customer, "cliente@example.com"))).toBe(403);
  });

  it("answers 404 for an unknown company", async () => {
    expect(await statusOf(invite(operator, "cliente@example.com", "co_missing"))).toBe(404);
  });

  it("refuses an e-mail that already has a membership", async () => {
    await signInAs({ orgId: OTHER_COMPANY_ID, role: "CUSTOMER", userId: "taken" });
    const status = await statusOf(invite(operator, emailOf("taken")));
    expect(status).toBe(409);
  });

  it("cancels the pending invitation when the same e-mail is invited again", async () => {
    const first = await invitedId(invite(operator, "cliente@example.com"));
    const second = await invitedId(invite(operator, "cliente@example.com"));

    const rows = await db((client) =>
      client.invitation.findMany({ select: { id: true, status: true }, where: {} }),
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        { id: first, status: "canceled" },
        { id: second, status: "pending" },
      ]),
    );
    expect(rows).toHaveLength(2);
  });
});

describe("accepting an invitation", () => {
  it("gives the invited Account a CUSTOMER membership in the Company", async () => {
    const invitationId = await invitedId(invite(operator, emailOf("invited")));
    const invited = await signIn([], "invited");

    expect(await statusOf(accept(invited, invitationId))).toBe(200);

    const membership = await db((client) =>
      client.orgMembership.findUnique({
        where: { userId_orgId: { orgId: COMPANY_ID, userId: "invited" } },
      }),
    );

    expect(membership?.role).toBe("CUSTOMER");
    const meRes = await fetchWithCookie(invited, "https://agents.test/api/me");
    const me = await meRes.json<MeResponse>();
    expect(me.orgs).toEqual([
      { id: COMPANY_ID, name: "Padaria Nova", role: "CUSTOMER", slug: COMPANY_ID },
    ]);
  });

  it("refuses an Account signed in with another e-mail", async () => {
    const invitationId = await invitedId(invite(operator, emailOf("invited")));
    const intruder = await signIn([], "intruder");

    expect(await statusOf(accept(intruder, invitationId))).toBe(403);
    expect(await membershipCount(COMPANY_ID)).toBe(0);
  });

  it("refuses a canceled invitation", async () => {
    const first = await invitedId(invite(operator, emailOf("invited")));
    await invite(operator, emailOf("invited"));
    const invited = await signIn([], "invited");

    expect(await statusOf(accept(invited, first))).toBe(400);
  });
});

describe("the organization plugin's own endpoints", () => {
  it("does not let a Customer invite members", async () => {
    const customer = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });

    const res = await post(customer, "/api/auth/organization/invite-member", {
      email: "friend@example.com",
      organizationId: COMPANY_ID,
      role: "CUSTOMER",
    });

    expect(res.status).toBe(403);
    expect(await db((client) => client.invitation.count())).toBe(0);
  });

  it("does not let a Customer create an organization", async () => {
    const customer = await signInAs({ orgId: COMPANY_ID, role: "CUSTOMER" });

    const res = await post(customer, "/api/auth/organization/create", {
      name: "Nova",
      slug: "nova",
    });

    expect(res.status).toBe(403);
    expect(await db((client) => client.organization.count({ where: { slug: "nova" } }))).toBe(0);
  });

  it("does not let an OWNER member delete the organization", async () => {
    const owner = await signInAs({ orgId: COMPANY_ID, role: "OWNER" });
    const res = await post(owner, "/api/auth/organization/delete", { organizationId: COMPANY_ID });

    expect(res.status).toBe(403);
    expect(await db((client) => client.organization.count({ where: { id: COMPANY_ID } }))).toBe(1);
  });
});
