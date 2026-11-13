"use client";

import { createSectionError } from "@repo/app-shell/section-error";
import type { BoundaryError } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const report = (error: BoundaryError) => {
  log.error({ digest: error.digest, error: error.message, message: "Section error boundary" });
};

const SectionError = createSectionError(report);

export { SectionError };
