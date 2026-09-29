import { Card } from "@repo/ui/components/card";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import type { Action } from "@repo/worker-api/contracts";

const proposalSummary = (proposed: Action["proposed"]): string | null =>
  typeof proposed.summary === "string" && proposed.summary !== "" ? proposed.summary : null;

const ProposalCard = ({ proposed }: { proposed: Action["proposed"] }) => {
  const summary = proposalSummary(proposed);
  return (
    <Card className="gap-4 p-5">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Proposta</h2>
      {summary !== null && (
        <div className="text-sm leading-relaxed text-foreground">
          <MarkdownResponse eagerImages>{summary}</MarkdownResponse>
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer text-sm font-medium text-foreground/80 transition-colors select-none hover:text-foreground">
          Ver proposta completa (JSON)
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-border bg-secondary/40 p-3 text-xs whitespace-pre-wrap">
          {JSON.stringify(proposed, null, 2)}
        </pre>
      </details>
    </Card>
  );
};

export { ProposalCard, proposalSummary };
