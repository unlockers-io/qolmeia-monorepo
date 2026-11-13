"use client";

import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useErrorReport } from "@repo/ui/hooks/use-error-report";

import styles from "./global-error.module.css";
import type { ErrorReportProps } from "./route-error";
import { MAIN_CONTENT_ID } from "./skip-link";

type GlobalErrorProps = ErrorReportProps & { subject: string };

const GlobalError = ({ error, report, retry, subject }: GlobalErrorProps) => {
  const headingRef = useErrorReport(error, report);
  const ready = useClientReady();

  return (
    <div className={styles.page}>
      <title>Algo deu errado</title>
      <main className={styles.main} id={MAIN_CONTENT_ID}>
        <h1 className={styles.heading} ref={headingRef} tabIndex={-1}>
          Algo deu errado
        </h1>
        <p className={styles.text}>
          {`${subject} parou de funcionar inesperadamente. Tente novamente e, se o problema continuar, recarregue a página ou volte em alguns minutos.`}
        </p>
        <button className={styles.button} disabled={!ready} onClick={retry} type="button">
          Tentar novamente
        </button>
        {error.digest !== undefined && <p className={styles.digest}>Referência: {error.digest}</p>}
      </main>
    </div>
  );
};

export { GlobalError };
