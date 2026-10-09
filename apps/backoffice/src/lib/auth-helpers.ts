import { createSessionHelpers } from "@repo/app-shell/session";

import { log } from "@/lib/observability";

const { requireMembership } = createSessionHelpers({ log, surface: "operator" });

export { requireMembership as requireOperator };
