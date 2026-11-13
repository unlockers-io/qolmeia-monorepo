import { apiGetServer } from "@repo/app-shell/server-api";
import { SIGNUP } from "@repo/worker-api/endpoints";
import { cache } from "react";

const getSignupState = cache(() => apiGetServer(SIGNUP));

export { getSignupState };
