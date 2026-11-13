"use client";

import { RouteError } from "@repo/app-shell/route-error";
import type { BoundaryError, ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const report = (error: BoundaryError) => {
  log.error({ digest: error.digest, error: error.message, message: "Route error boundary" });
};

const DashboardError = (props: ErrorBoundaryProps) => <RouteError {...props} report={report} />;

export default DashboardError;
