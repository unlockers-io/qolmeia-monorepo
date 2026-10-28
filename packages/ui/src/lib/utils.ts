import type { ReactNode } from "react";

// Optional slots are usually passed as `cond && <X />`, so `false`, `""` and `0`
// must render nothing rather than an empty wrapper. A nullish check alone would
// let those through.
const isRenderable: (node: ReactNode) => boolean = Boolean;

export { isRenderable };

export { cn } from "cn";
