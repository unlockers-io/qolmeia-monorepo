import type { CustomerInvitation } from "@repo/worker-api/contracts";

import { recordActivity } from "#/activity/log";
import type { WorkerAuth } from "#/lib/auth";
import type { PrismaClient } from "#/lib/db";

type InviteCustomerInput = { companyId: string; email: string; inviterId: string };

type InviteCustomerResult =
  | { companyName: string; invitation: CustomerInvitation; kind: "invited" }
  | { kind: "already_member" }
  | { kind: "company_not_found" };

/**
 * A Customer belongs to exactly one Company (ADR 0011), so an e-mail that already holds any
 * membership is refused.
 */
const inviteCustomer = async (
  auth: WorkerAuth,
  db: PrismaClient,
  { companyId, email, inviterId }: InviteCustomerInput,
): Promise<InviteCustomerResult> => {
  const [company, membership] = await Promise.all([
    db.company.findUnique({ select: { name: true }, where: { id: companyId } }),
    db.orgMembership.findFirst({ select: { id: true }, where: { user: { email } } }),
  ]);
  if (company === null) {
    return { kind: "company_not_found" };
  }
  if (membership !== null) {
    return { kind: "already_member" };
  }
  const invitation = await auth.api.createCustomerInvitation({
    body: { email, inviterId, organizationId: companyId },
  });
  await recordActivity(db, {
    actorId: inviterId,
    companyId,
    payload: { email },
    refId: invitation.id,
    refType: "invitation",
    summary: `Convite enviado para ${email}.`,
    type: "CUSTOMER_INVITED",
  });
  return {
    companyName: company.name,
    invitation: { email, expiresAt: new Date(invitation.expiresAt).getTime(), id: invitation.id },
    kind: "invited",
  };
};

export { inviteCustomer };
