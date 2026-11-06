import "./fields";

import { initLogger } from "evlog";

import { buildConfig } from "./config";

const initApiLogger = (opts: { service: string }): void => {
  initLogger(buildConfig(opts.service));
};

export { evlog as honoEvlog } from "evlog/hono";

export { initApiLogger };

export type { EvlogVariables } from "evlog/hono";
