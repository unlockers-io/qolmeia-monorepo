"use client";

import { createBetterAuthClient } from "@repo/auth/client";
import { magicLinkClient, usernameClient } from "better-auth/client/plugins";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { runWithCleanup } from "../lib/run-with-cleanup";
import { toast } from "../lib/toast";

import { Button } from "./button";

const authUrl = process.env.NEXT_PUBLIC_AUTH_URL;
const authClient = createBetterAuthClient({
  baseURL: authUrl !== undefined && authUrl !== "" ? `${authUrl}/api/auth` : "",
  plugins: [usernameClient(), magicLinkClient()],
});

type SignOutButtonProps = {
  className?: string;
  label?: string;
};

type SignOutButtonDependencies = {
  router: Pick<ReturnType<typeof useRouter>, "push" | "refresh">;
  showError: (message: string) => void;
  signOut: () => Promise<void>;
};

const DEFAULT_DEPENDENCIES: Omit<SignOutButtonDependencies, "router"> = {
  showError: (message) => {
    toast.error(message);
  },
  signOut: async () => {
    await authClient.signOut();
  },
};

const SignOutButtonView = ({
  className,
  dependencies,
  label = "Sair",
}: SignOutButtonProps & { dependencies: SignOutButtonDependencies }) => {
  const { router, showError, signOut } = dependencies;
  const { push, refresh } = router;
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    if (pending) {
      return;
    }
    setPending(true);
    await runWithCleanup(
      async () => {
        try {
          await signOut();
          push("/login");
          refresh();
        } catch {
          showError("Não foi possível sair. Tente novamente.");
        }
      },
      () => {
        setPending(false);
      },
    );
  };

  return (
    <Button
      className={className}
      disabled={pending}
      onClick={() => {
        void handleSignOut();
      }}
      type="button"
      variant="ghost"
    >
      <LogOut aria-hidden />
      {label}
    </Button>
  );
};

const SignOutButton = (props: SignOutButtonProps) => {
  const router = useRouter();
  return <SignOutButtonView {...props} dependencies={{ ...DEFAULT_DEPENDENCIES, router }} />;
};

export { SignOutButton, SignOutButtonView };
export type { SignOutButtonDependencies, SignOutButtonProps };
