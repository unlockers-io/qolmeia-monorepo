import { Card } from "@repo/ui/components/card";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import type { Action } from "@repo/worker-api/contracts";

import { proposalSummary } from "@/components/action-renderers/proposal-summary";

const PreviousRound = ({
  round,
  roundIndex,
}: {
  round: Action | undefined;
  roundIndex: number;
}) => {
  const feedback = round?.feedback;
  if (round === undefined || feedback === undefined || feedback === null || feedback === "") {
    return null;
  }
  const previousSummary = proposalSummary(round.proposed);
  return (
    <Card className="gap-3 p-5">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Ajuste pedido na rodada {roundIndex}
      </h2>
      <p className="text-sm leading-relaxed text-foreground">“{feedback}”</p>
      {previousSummary !== null && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground/80 select-none hover:text-foreground">
            Ver a versão anterior
          </summary>
          <div className="mt-3 leading-relaxed text-foreground">
            <MarkdownResponse>{previousSummary}</MarkdownResponse>
          </div>
        </details>
      )}
    </Card>
  );
};

export { PreviousRound };
