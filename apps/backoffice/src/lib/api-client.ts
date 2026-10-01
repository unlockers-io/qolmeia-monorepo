import { createBrowserApi } from "@repo/worker-api";

const { apiGet, apiSend } = createBrowserApi("/api/backoffice");

export { apiGet, apiSend };
export { ApiError, describeRequestError } from "@repo/worker-api";
