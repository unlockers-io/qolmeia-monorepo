import { createBrowserApi } from "@repo/worker-api";

const { activeOrgId, apiGet, apiSend, apiSendForm } = createBrowserApi({ allow: ["CUSTOMER"] });

export { activeOrgId, apiGet, apiSend, apiSendForm };
