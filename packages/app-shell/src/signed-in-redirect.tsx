"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "./auth-client";

/**
 * Sends a visitor who already holds a valid session away from the sign-in pages. It asks Better
 * Auth rather than trusting the cookie, which also clears a stale one.
 */
const SignedInRedirect = () => {
  const { data } = authClient.useSession();
  const { replace } = useRouter();

  useEffect(() => {
    if (data !== null) {
      replace("/");
    }
  }, [data, replace]);

  return null;
};

export { SignedInRedirect };
