"use client";

import { useErrorBoundary, type ErrorPageProps } from "@repo/app-shell/error-boundary";
import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { RefreshCw } from "lucide-react";

import { log } from "@/lib/observability-client";

const RouteError = ({ error, retry }: ErrorPageProps) => {
  const headingRef = useErrorBoundary(error, log, "Route error boundary");
  const ready = useClientReady();

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-32 text-center sm:px-8">
      <div className="flex flex-col gap-2">
        <h1
          className="font-display text-2xl font-semibold tracking-tight outline-none"
          ref={headingRef}
          tabIndex={-1}
        >
          Algo deu errado
        </h1>
        <p className="max-w-measure-footer text-base text-pretty text-muted-foreground">
          Não conseguimos carregar esta página. Tente novamente e, se o problema continuar, volte em
          alguns minutos.
        </p>
        {error.digest !== undefined && (
          <p className="font-mono text-xs text-muted-foreground">Referência: {error.digest}</p>
        )}
      </div>
      <Button disabled={!ready} onClick={retry} variant="outline">
        <RefreshCw aria-hidden="true" data-icon="inline-start" />
        Tentar novamente
      </Button>
    </div>
  );
};

export default RouteError;
