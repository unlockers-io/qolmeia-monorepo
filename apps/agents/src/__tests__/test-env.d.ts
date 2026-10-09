/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type * as WorkerEntry from "#/__tests__/worker-entry";

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      durableNamespaces: "TeamEvents";
      mainModule: typeof WorkerEntry;
    }
  }
}
