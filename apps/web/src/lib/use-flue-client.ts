import { createFlueClient } from "@flue/sdk";
import { useState } from "react";

const createConnection = (url: string) => ({
  client: createFlueClient({
    fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
    url,
  }),
  url,
});

const useFlueClient = (url: string) => {
  const [connection, setConnection] = useState(() => createConnection(url));
  // Client identity owns the live SSE session: it is resource state, not a
  // discardable render cache. Replace it only when its endpoint changes.
  if (connection.url !== url) {
    setConnection(createConnection(url));
  }
  return connection.client;
};

export { useFlueClient };
