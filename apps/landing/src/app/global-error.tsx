"use client";

import { GlobalError } from "@repo/app-shell/global-error";
import type { ComponentProps } from "react";

import { log } from "@/lib/observability-client";

const SiteGlobalError = (props: Omit<ComponentProps<typeof GlobalError>, "log" | "subject">) => (
  <GlobalError {...props} log={log} subject="O site" />
);

export default SiteGlobalError;
