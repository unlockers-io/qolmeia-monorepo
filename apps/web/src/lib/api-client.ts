import { createBrowserApi } from "@repo/worker-api";

const { apiGet, apiSend, apiSendForm } = createBrowserApi();

export { apiGet, apiSend, apiSendForm };
