"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useErrorReport, type ReportError } from "@repo/ui/hooks/use-error-report";
import { CircleAlert } from "lucide-react";
import { catchError, type ErrorInfo } from "next/error";

type SectionErrorProps = {
  /** Draws the fallback inside a card, for a section that is not already in one. */
  framed?: boolean;
  /** Completes "Não foi possível carregar …", article included: "a atividade", "os eventos". */
  what: string;
};

type SectionErrorViewProps = SectionErrorProps & ErrorInfo & { report: ReportError };

const toError = (thrown: ErrorInfo["error"]): Error =>
  thrown instanceof Error ? thrown : new Error(String(thrown));

const SectionErrorView = ({
  error,
  framed = false,
  report,
  retry,
  what,
}: SectionErrorViewProps) => {
  const headingRef = useErrorReport(toError(error), report);
  const ready = useClientReady();

  const message = (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <CircleAlert className="size-5" />
      </div>
      <h2 className="text-sm font-medium text-foreground" ref={headingRef} tabIndex={-1}>
        Dados indisponíveis
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Não foi possível carregar {what} agora.
      </p>
      <Button disabled={!ready} onClick={retry} size="sm" variant="outline">
        Tentar novamente
      </Button>
    </div>
  );

  return framed ? (
    <Card>
      <CardContent>{message}</CardContent>
    </Card>
  ) : (
    message
  );
};

/**
 * A boundary for one section of a page: when its content fails to load, the section says so and
 * offers a retry while the rest of the page stays. `report` must be a module-level function.
 */
const createSectionError = (report: ReportError) =>
  catchError((props: SectionErrorProps, errorInfo: ErrorInfo) => (
    <SectionErrorView {...props} {...errorInfo} report={report} />
  ));

export { createSectionError };
