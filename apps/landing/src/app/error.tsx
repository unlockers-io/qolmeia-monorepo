"use client";

import { Button } from "@repo/ui/components/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

import { log } from "@/lib/observability-client";

type RouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const RouteError = ({ error, retry }: RouteErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    log.error({ digest: error.digest, error: error.message, message: "Route error boundary" });
    headingRef.current?.focus();
  }, [error]);

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
        <p className="max-w-(--container-measure-footer) text-base text-pretty text-muted-foreground">
          Não conseguimos carregar esta página. Tente novamente e, se o problema continuar, volte em
          alguns minutos.
        </p>
        {error.digest !== undefined && (
          <p className="font-mono text-xs text-muted-foreground">Referência: {error.digest}</p>
        )}
      </div>
      <Button onClick={retry} variant="outline">
        <RefreshCw aria-hidden="true" data-icon="inline-start" />
        Tentar novamente
      </Button>
    </div>
  );
};

export default RouteError;
