"use client";

import { GlobalError } from "@repo/app-shell/global-error";
import type { BoundaryError, ErrorBoundaryProps } from "@repo/ui/hooks/use-error-report";

import { log } from "@/lib/observability-client";

const report = (error: BoundaryError) => {
  log.error({ digest: error.digest, error: error.message, message: "Global error boundary" });
};

const SiteGlobalError = (props: ErrorBoundaryProps) => (
  <html lang="pt-BR">
    <body>
      <GlobalError {...props} report={report} subject="O site" />
    </body>
  </html>
);

export default SiteGlobalError;
