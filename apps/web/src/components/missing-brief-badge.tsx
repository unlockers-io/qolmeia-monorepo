import { badgeVariants } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps } from "react";

const MissingBriefBadge = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    className={cn(badgeVariants(), "bg-warning-surface text-warning-surface-foreground", className)}
    data-slot="badge"
    {...props}
  />
);

export { MissingBriefBadge };
