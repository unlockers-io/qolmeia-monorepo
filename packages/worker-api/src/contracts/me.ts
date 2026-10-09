import { OrgRole } from "@repo/db/enums";

type Surface = "customer" | "operator";

const SURFACE_OF_ROLE = {
  CUSTOMER: "customer",
  OWNER: "operator",
  STAFF: "operator",
} as const satisfies Record<OrgRole, Surface>;

const OPERATOR_ROLES = Object.values(OrgRole).filter(
  (role) => SURFACE_OF_ROLE[role] === "operator",
);

/**
 * The membership a caller acts through on a surface. A Customer belongs to one Company and an
 * Operator to the one Qolmeia org (ADR 0005), so a surface has a single candidate. For data that
 * breaks that invariant the memberships arrive oldest first and the oldest wins.
 */
const activeMembership = <Membership extends { role: OrgRole }>(
  memberships: ReadonlyArray<Membership>,
  surface: Surface,
): Membership | null =>
  memberships.find((membership) => SURFACE_OF_ROLE[membership.role] === surface) ?? null;

type MeOrg = {
  id: string;
  name: string;
  role: OrgRole;
  slug: string;
};

type MeUser = {
  displayName: string | null;
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
  username: string | null;
};

type MeResponse = {
  orgs: ReadonlyArray<MeOrg>;
  user: MeUser;
};

type SignupState = { open: boolean };

export { activeMembership, OPERATOR_ROLES };
export type { MeOrg, MeResponse, MeUser, SignupState, Surface };
export type { OrgRole } from "@repo/db/enums";
