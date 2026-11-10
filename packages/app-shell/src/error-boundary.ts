import { useEffect, useRef } from "react";

type BoundaryError = Error & { digest?: string };

type BoundaryLog = {
  error: (event: { digest?: string; error: string; message: string }) => void;
};

/** What Next.js passes an `error.tsx` or `global-error.tsx` boundary. */
type ErrorPageProps = {
  error: BoundaryError;
  retry: () => void;
};

type ErrorBoundaryProps = ErrorPageProps & { log: BoundaryLog };

/** Logs the error once and moves focus to the returned heading, so a screen reader announces it. */
const useErrorBoundary = (error: BoundaryError, log: BoundaryLog, message: string) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    log.error({ digest: error.digest, error: error.message, message });
    headingRef.current?.focus();
  }, [error, log, message]);

  return headingRef;
};

export { useErrorBoundary };

export type { ErrorBoundaryProps, ErrorPageProps };
