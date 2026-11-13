/// <reference types="@cloudflare/vitest-plugin/types" />

import type * as WorkerEntry from "#/__tests__/worker-entry";

declare module "vitest" {
  interface ProvidedContext {
    wranglerCrons: ReadonlyArray<string>;
    wranglerVectorIndexes: ReadonlyArray<string>;
  }
}

declare global {
  namespace Cloudflare {
    interface GlobalProps {
      durableNamespaces: "TeamEvents";
      mainModule: typeof WorkerEntry;
    }
  }
}
