"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "./auth-client";
import { safeRedirectPath } from "./redirect-path";

/**
 * Sends a visitor who already holds a valid session away from the sign-in pages, to the `from`
 * path when there is one. It asks Better Auth rather than trusting the cookie, which also clears a
 * stale one.
 */
const SignedInRedirect = () => {
  const { data } = authClient.useSession();
  const { replace } = useRouter();

  useEffect(() => {
    if (data !== null) {
      replace(safeRedirectPath(new URLSearchParams(window.location.search).get("from")));
    }
  }, [data, replace]);

  return null;
};

export { SignedInRedirect };
