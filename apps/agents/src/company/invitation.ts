import type { CustomerInvitation } from "@repo/worker-api/contracts";

import { recordActivity } from "#/activity/log";
import type { WorkerAuth } from "#/lib/auth";
import type { PrismaClient } from "#/lib/db";
import { DomainError } from "#/lib/errors";

type InviteCustomerInput = { companyId: string; email: string; inviterId: string };

type InviteCustomerResult = { companyName: string; invitation: CustomerInvitation };

/**
 * A Customer belongs to exactly one Company (ADR 0011), so an e-mail that already holds any
 * membership is refused.
 */
const inviteCustomer = async (
  auth: WorkerAuth,
  db: PrismaClient,
  { companyId, inviterId, ...input }: InviteCustomerInput,
): Promise<InviteCustomerResult> => {
  const email = input.email.toLowerCase();

  const [company, membership] = await Promise.all([
    db.company.findUnique({ select: { name: true }, where: { id: companyId } }),
    db.orgMembership.findFirst({ select: { id: true }, where: { user: { email } } }),
  ]);

  if (company === null) {
    throw new DomainError(404, "not found");
  }

  if (membership !== null) {
    throw new DomainError(409, "email already belongs to a member");
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
  };
};

export { inviteCustomer };
