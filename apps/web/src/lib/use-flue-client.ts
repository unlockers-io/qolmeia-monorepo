import { createFlueClient } from "@flue/sdk";
import { useState } from "react";

type ConnectionOptions = {
  sessionToken?: string;
  url: string;
};

const createConnection = ({ sessionToken, url }: ConnectionOptions) => ({
  client: createFlueClient({
    fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
    token: sessionToken === "" ? undefined : sessionToken,
    url,
  }),
  sessionToken,
  url,
});

const useFlueClient = ({ sessionToken, url }: ConnectionOptions) => {
  const [connection, setConnection] = useState(() => createConnection({ sessionToken, url }));
  // Client identity owns the live SSE session: it is resource state, not a
  // discardable render cache. Replace it only when its endpoint or identity changes.
  if (connection.sessionToken !== sessionToken || connection.url !== url) {
    setConnection(createConnection({ sessionToken, url }));
  }
  return connection.client;
};

export { useFlueClient };
