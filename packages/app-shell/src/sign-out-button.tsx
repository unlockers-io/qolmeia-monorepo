"use client";

import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "./auth-client";

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
  const ready = useClientReady();

  const handleSignOut = async () => {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await signOut();
      push("/login");
      refresh();
    } catch {
      showError("Não foi possível sair. Tente novamente.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      className={className}
      disabled={!ready || pending}
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

export type { SignOutButtonDependencies };
