import type { OrgRole } from "@repo/db/enums";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { createAccessControl, type Role } from "better-auth/plugins/access";
import { getOrgAdapter, type OrganizationOptions } from "better-auth/plugins/organization";
import { defaultStatements } from "better-auth/plugins/organization/access";
import type { BetterAuthPlugin } from "better-auth/types";
import { z } from "zod";

import { LINK_LIFETIME_SECONDS } from "./link-lifetimes";

const accessControl = createAccessControl(defaultStatements);

const NO_PERMISSIONS = accessControl.newRole({
  ac: [],
  invitation: [],
  member: [],
  organization: [],
  team: [],
});

/** Operators manage Companies through backoffice REST, so the plugin's own endpoints grant nothing. */
const ROLES = {
  CUSTOMER: NO_PERMISSIONS,
  OWNER: NO_PERMISSIONS,
  STAFF: NO_PERMISSIONS,
} satisfies Record<OrgRole, Role>;

const organizationOptions = {
  ac: accessControl,
  allowUserToCreateOrganization: false,
  creatorRole: "OWNER",
  invitationExpiresIn: LINK_LIFETIME_SECONDS.invitation,
  roles: ROLES,
  schema: {
    member: { fields: { organizationId: "orgId" }, modelName: "orgMembership" },
  },
} satisfies OrganizationOptions;

const customerInvitationBody = z.object({
  email: z.email(),
  inviterId: z.string().min(1),
  organizationId: z.string().min(1),
});

/**
 * The plugin's invite endpoint requires the inviter to be a member, and Operators belong to no
 * customer Company (ADR 0005). Re-inviting cancels the pending invitation.
 */
const customerInvitations = () =>
  ({
    endpoints: {
      createCustomerInvitation: createAuthEndpoint.serverOnly(
        { body: customerInvitationBody, method: "POST" },
        async (ctx) => {
          const { email, inviterId, organizationId } = ctx.body;
          const inviter = await ctx.context.internalAdapter.findUserById(inviterId);

          if (inviter === null) {
            throw APIError.from("BAD_REQUEST", {
              code: "INVITER_NOT_FOUND",
              message: "Inviter not found",
            });
          }

          const orgAdapter = getOrgAdapter(ctx.context, organizationOptions);
          const pending = await orgAdapter.findPendingInvitation({ email, organizationId });
          await Promise.all(
            pending.map(({ id }) =>
              orgAdapter.updateInvitation({ invitationId: id, status: "canceled" }),
            ),
          );

          const invitation = await orgAdapter.createInvitation({
            invitation: { email, organizationId, role: "CUSTOMER", teamIds: [] },
            user: inviter,
          });

          return ctx.json({ expiresAt: invitation.expiresAt, id: invitation.id });
        },
      ),
    },
    id: "customer-invitations",
  }) satisfies BetterAuthPlugin;

export { customerInvitations, organizationOptions };
