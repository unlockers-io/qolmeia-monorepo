import "./fields";

import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation/create";

import { buildConfig } from "./config";

const createObservability = (opts: { service: string }) => {
  const { redact, ...shared } = buildConfig(opts.service);
  const next = createEvlog({ redact, service: opts.service, ...shared });

  const instrumentation = createInstrumentation({
    service: opts.service,
    ...shared,
    captureOutput: true,
  });

  return {
    log: next.log,
    onRequestError: instrumentation.onRequestError,
    register: instrumentation.register,
  };
};

export { createObservability };

export { evlogMiddleware } from "evlog/next";
