import type { ReactNode } from "react";

import { isRenderable } from "../lib/is-renderable";
import { cn } from "../lib/utils";

type EmptyStateProps = {
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title?: ReactNode;
};

const EmptyState = ({ className, description, icon, title }: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
      className,
    )}
  >
    {isRenderable(icon) ? (
      <div
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5"
      >
        {icon}
      </div>
    ) : null}
    {isRenderable(title) ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
    {isRenderable(description) ? (
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    ) : null}
  </div>
);

export { EmptyState };
