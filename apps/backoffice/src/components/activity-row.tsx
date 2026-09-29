import { cn } from "@repo/ui/lib/utils";
import type { ActivityEntry } from "@repo/worker-api/contracts";

import { activityStyle } from "@/lib/activity-category";
import { formatRelative } from "@/lib/format";

type ActivityRowProps = {
  row: ActivityEntry;
};

const hasPayload = (payload: ActivityEntry["payload"]): boolean =>
  payload !== null && Object.keys(payload).length > 0;

const ActivityRow = ({ row }: ActivityRowProps) => {
  const style = activityStyle(row.type);

  return (
    <li className="flex flex-col gap-2 border-b border-border px-5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 md:flex-nowrap">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium",
            style.tag,
          )}
          title={row.type}
        >
          {style.label}
        </span>
        <span className="order-last w-full text-sm text-foreground md:order-none md:w-auto md:min-w-0 md:flex-1 md:truncate">
          {row.summary}
        </span>
        <span className="text-xs whitespace-nowrap text-muted-foreground md:shrink-0">
          {row.companyName}
        </span>
        <time className="ml-auto text-xs whitespace-nowrap text-muted-foreground md:ml-0 md:min-w-24 md:shrink-0 md:text-right">
          {formatRelative(row.createdAt)}
        </time>
      </div>
      {hasPayload(row.payload) && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer text-xs font-medium select-none hover:text-foreground">
            Ver detalhes técnicos
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(row.payload, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
};

export { ActivityRow };
