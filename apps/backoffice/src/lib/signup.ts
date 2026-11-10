import { apiGetServer } from "@repo/app-shell/server-api";
import type { SignupState } from "@repo/worker-api/contracts";
import { cache } from "react";

const getSignupState = cache((): Promise<SignupState> => apiGetServer<SignupState>("/api/signup"));

export { getSignupState };
