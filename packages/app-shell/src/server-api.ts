import { createServerApi, type ServerApi } from "@repo/worker-api";
import { headers } from "next/headers";

import { agentsServerUrl } from "./agents-url";

const readCookieHeader = async (): Promise<string> => {
  const headersList = await headers();
  return headersList.get("cookie") ?? "";
};

const createAppServerApi = (basePath?: string): ServerApi =>
  createServerApi({ basePath, baseUrl: agentsServerUrl(), readCookieHeader });

export { createAppServerApi };
