import type { OrgRole } from "@repo/db/enums";

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

export type { MeOrg, MeResponse, MeUser };
