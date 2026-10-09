import { createSessionHelpers } from "@repo/app-shell/session";

import { log } from "@/lib/observability";

const { getActiveOrgId, requireMembership } = createSessionHelpers({
  allow: ["CUSTOMER"],
  log,
});

export { getActiveOrgId, requireMembership as requireCustomer };
