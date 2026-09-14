import type { ComponentProps } from "react";

import { cn } from "../lib/utils";

const Textarea = ({
  className,
  variant = "default",
  ...props
}: ComponentProps<"textarea"> & { variant?: "default" | "code" | "prompt" }) => (
  <textarea
    className={cn(
      "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors outline-none",
      "placeholder:text-muted-foreground",
      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
      "dark:bg-input/30",
      variant === "code" && "font-mono text-[0.8125rem]",
      variant === "prompt" && "text-[0.84375rem] leading-relaxed",
      className,
    )}
    data-slot="textarea"
    {...props}
  />
);

export { Textarea };
