"use client";

import { RouteError } from "@repo/app-shell/route-error";
import type { ComponentProps } from "react";

import { log } from "@/lib/observability-client";

const ClientError = (props: Omit<ComponentProps<typeof RouteError>, "log">) => (
  <RouteError {...props} log={log} />
);

export default ClientError;
