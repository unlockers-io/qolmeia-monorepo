import { Hono } from "hono";

import { requireMemberForDiscovery, type DiscoveryContextVars } from "@/middleware/require-staff";

import { buildMeRoutes } from "./me";

type V1RouteDeps = {
  memberGuard?: ReturnType<typeof requireMemberForDiscovery>;
  routes?: {
    me?: ReturnType<typeof buildMeRoutes>;
  };
};

const buildApiRoutes = (deps: V1RouteDeps = {}): Hono => {
  const app = new Hono();
  const memberGuard = deps.memberGuard ?? requireMemberForDiscovery();

  const meApp = new Hono<{ Variables: DiscoveryContextVars }>();
  meApp.use("*", memberGuard);
  meApp.route("/", deps.routes?.me ?? buildMeRoutes());
  app.route("/me", meApp);

  return app;
};

export { buildApiRoutes };
export type { V1RouteDeps };
