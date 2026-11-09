import { Card } from "@repo/ui/components/card";
import { MarkdownResponse } from "@repo/ui/compositions/markdown-response";
import type { Deliverable } from "@repo/worker-api/contracts";

const ProposalCard = ({ proposed }: { proposed: Deliverable }) => (
  <Card className="gap-4 p-5">
    <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Proposta</h2>
    {proposed.summary !== "" && (
      <div className="text-sm leading-relaxed text-foreground">
        <MarkdownResponse eagerImages>{proposed.summary}</MarkdownResponse>
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

export { ProposalCard };
