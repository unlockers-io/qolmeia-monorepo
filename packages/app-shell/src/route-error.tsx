"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useErrorReport } from "@repo/ui/hooks/use-error-report";
import type { ErrorBoundaryProps, ReportError } from "@repo/ui/hooks/use-error-report";

import { MAIN_CONTENT_ID } from "./skip-link";

type ErrorReportProps = ErrorBoundaryProps & { report: ReportError };

const RouteError = ({ error, report, retry }: ErrorReportProps) => {
  const headingRef = useErrorReport(error, report);
  const ready = useClientReady();

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center"
      id={MAIN_CONTENT_ID}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground" ref={headingRef} tabIndex={-1}>
          Não foi possível carregar esta página
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Algo falhou do nosso lado. Tente de novo em instantes; seus dados continuam salvos.
        </p>
      </div>
      <Button disabled={!ready} onClick={retry}>
        Tentar novamente
      </Button>
    </main>
  );
};

export { RouteError };

export type { ErrorReportProps };
