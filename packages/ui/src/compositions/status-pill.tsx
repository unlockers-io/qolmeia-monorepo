import type { ComponentProps } from "react";

import { badgeVariants } from "../components/badge";
import { cn } from "../lib/utils";

type StatusTone = "danger" | "info" | "neutral" | "success" | "warning";

type ToneContract = Record<StatusTone, { dot: string; pill: string }>;

const TONE = {
  danger: {
    dot: "bg-destructive",
    pill: "bg-destructive-surface text-destructive-surface-foreground",
  },
  info: { dot: "bg-info", pill: "bg-info-surface text-info-surface-foreground" },
  neutral: { dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground" },
  success: { dot: "bg-success", pill: "bg-success-surface text-success-surface-foreground" },
  warning: { dot: "bg-warning", pill: "bg-warning-surface text-warning-surface-foreground" },
} satisfies ToneContract;

type StatusPillProps = ComponentProps<"span"> & {
  dotless?: boolean;
  label: string;
  pulse?: boolean;
  tone: StatusTone;
};

const StatusPill = ({ className, dotless, label, pulse, tone, ...props }: StatusPillProps) => {
  const t = TONE[tone];
  return (
    <span className={cn(badgeVariants({ variant: "secondary" }), t.pill, className)} {...props}>
      {dotless === true ? null : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            t.dot,
            pulse === true && "motion-safe:animate-qpulse",
          )}
        />
      )}
      {label}
    </span>
  );
};

export { StatusPill };
export type { StatusTone };
