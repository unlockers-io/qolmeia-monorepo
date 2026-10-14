import type { SignupState } from "@repo/worker-api/contracts";
import { cache } from "react";

import { createAppServerApi } from "./server-api";

const getSignupState = cache((): Promise<SignupState> =>
  createAppServerApi().apiGetServer<SignupState>("/api/signup"),
);

export { getSignupState };
export { SIGNUP_CLOSED_MESSAGE } from "@repo/auth/signup";
