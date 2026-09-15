"use client";

import { useEffect, useRef } from "react";

import { log } from "@/lib/observability-client";

import styles from "./global-error.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const GlobalError = ({ error, reset }: GlobalErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    log.error({ digest: error.digest, error: error.message, message: "Global error boundary" });
    headingRef.current?.focus();
  }, [error]);

  return (
    <html className={styles.document} lang="pt-BR">
      <body className={styles.body}>
        <main className={styles.main} id="main-content">
          <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
            Algo deu errado
          </h1>
          <p className={styles.text}>
            O aplicativo parou de funcionar inesperadamente. Tente novamente e, se o problema
            continuar, recarregue a página ou volte em alguns minutos.
          </p>
          <button className={styles.button} onClick={reset} type="button">
            Tentar novamente
          </button>
          {error.digest !== undefined && (
            <p className={styles.digest}>Referência: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
