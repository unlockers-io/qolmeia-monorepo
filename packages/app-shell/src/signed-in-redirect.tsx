"use client";

import { redirectFrom } from "@repo/auth/redirect-path";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "./auth-client";

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
      replace(redirectFrom(window.location.search));
    }
  }, [data, replace]);

  return null;
};

export { SignedInRedirect };
