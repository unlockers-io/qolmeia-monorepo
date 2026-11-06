import { Card } from "@repo/ui/components/card";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import type { Action } from "@repo/worker-api/contracts";

const PreviousRound = ({
  round,
  roundIndex,
}: {
  round: Action | undefined;
  roundIndex: number;
}) => {
  if (round === undefined || round.feedback === null || round.feedback === "") {
    return null;
  }

  const previousSummary = round.proposed.summary;

  return (
    <Card className="gap-3 p-5">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Ajuste pedido na rodada {roundIndex}
      </h2>
      <p className="text-sm leading-relaxed text-foreground">“{round.feedback}”</p>
      {previousSummary !== "" && (
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
