import { ApiError } from "@repo/worker-api";
import {
  activeMembership,
  type MeOrg,
  type MeResponse,
  type MeUser,
  type Surface,
} from "@repo/worker-api/contracts";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { createAppServerApi } from "./server-api";

type AppLogFields = {
  error?: unknown;
  message: string;
};
type AppLogger = { error: (fields: AppLogFields) => void };

type Membership = { org: MeOrg; user: MeUser };

type SessionConfig = {
  log: AppLogger;
  readMe?: () => Promise<MeResponse>;
  surface: Surface;
};

const UNAUTHORIZED = 401;

/**
 * The Worker answers /api/me; a 401 means signed out. Anything else that fails is an outage,
 * thrown so the route's error boundary renders instead of signing the visitor out.
 */
const createSessionHelpers = ({
  log,
  readMe = () => createAppServerApi().apiGetServer<MeResponse>("/api/me"),
  surface,
}: SessionConfig) => {
  const fetchMe = cache(async (): Promise<MeResponse> => {
    try {
      return await readMe();
    } catch (error) {
      unstable_rethrow(error);
      if (error instanceof ApiError && error.status === UNAUTHORIZED) {
        redirect("/login");
      }
      log.error({ error, message: "app-shell: /api/me failed" });
      throw error;
    }
  });

  const requireMembership = async (): Promise<Membership> => {
    const me = await fetchMe();
    const org = activeMembership(me.orgs, surface);
    if (org === null) {
      redirect("/no-access");
    }
    return { org, user: me.user };
  };

  return { requireMembership };
};

export { createSessionHelpers };
export type { AppLogger, Membership };
