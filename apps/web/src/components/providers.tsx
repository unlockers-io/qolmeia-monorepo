"use client";

import { describeRequestError } from "@repo/worker-api";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

declare module "@tanstack/react-query" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation requires `interface`, not `type`
  interface Register {
    queryMeta: { errorToast?: string };
  }
}

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => {
    const lastToastedByQuery = new Map<string, string>();

    return new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          staleTime: 30_000,
        },
      },
      queryCache: new QueryCache({
        onError: (error, query) => {
          const prefix = query.meta?.errorToast;

          if (prefix === undefined) {
            return;
          }

          const message = describeRequestError(error, `${prefix}. Tente de novo.`);

          if (lastToastedByQuery.get(query.queryHash) === message) {
            return;
          }

          lastToastedByQuery.set(query.queryHash, message);
          toast.error(message);
        },
        onSuccess: (_data, query) => {
          lastToastedByQuery.delete(query.queryHash);
        },
      }),
    });
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

export { Providers };
