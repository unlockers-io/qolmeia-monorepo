import { createServerApi } from "@repo/worker-api";
import { headers } from "next/headers";

import { agentsServerUrl } from "./agents-url";

const readCookieHeader = async (): Promise<string> => {
  const headersList = await headers();

  return headersList.get("cookie") ?? "";
};

const { apiGetServer } = createServerApi({ baseUrl: agentsServerUrl(), readCookieHeader });

export { apiGetServer };
