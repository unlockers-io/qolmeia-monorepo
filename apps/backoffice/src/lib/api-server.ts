import { createAppServerApi } from "@repo/app-shell/server-api";

const { apiGetServer } = createAppServerApi("/api/backoffice");

export { apiGetServer };
