"use client";

import { authClient, authRequest, type AuthError } from "@repo/app-shell/auth-client";
import { loginHref } from "@repo/auth/redirect-path";
import { Button } from "@repo/ui/components/button";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const UNAUTHORIZED = 401;

type AcceptInvitationDependencies = {
  acceptInvitation: (invitationId: string) => Promise<{ error: AuthError | null }>;
  router: Pick<ReturnType<typeof useRouter>, "push" | "refresh" | "replace">;
};

type AcceptInvitationProps = { invitationId: string };

const acceptWithBetterAuth: AcceptInvitationDependencies["acceptInvitation"] = async (
  invitationId,
) => {
  const { error } = await authClient.organization.acceptInvitation({ invitationId });

  return { error };
};

const AcceptInvitationView = ({
  dependencies,
  invitationId,
}: AcceptInvitationProps & { dependencies: AcceptInvitationDependencies }) => {
  const { acceptInvitation, router } = dependencies;
  const { push, refresh, replace } = router;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAccepting, startAccepting] = useTransition();
  const ready = useClientReady();

  const accept = () => {
    setErrorMessage(null);
    startAccepting(async () => {
      const outcome = await authRequest(
        () => acceptInvitation(invitationId),
        "Não foi possível aceitar o convite. Tente novamente.",
      );

      if (outcome.error === null) {
        push("/");
        refresh();

        return;
      }

      if (outcome.status === UNAUTHORIZED) {
        replace(loginHref(`/convite/${invitationId}`));

        return;
      }

      setErrorMessage(outcome.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        className="w-full"
        disabled={!ready || isAccepting}
        onClick={accept}
        size="lg"
        type="button"
      >
        {isAccepting ? "Aceitando…" : "Aceitar convite"}
      </Button>
      {errorMessage !== null && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

const AcceptInvitation = ({ invitationId }: AcceptInvitationProps) => {
  const router = useRouter();

  return (
    <AcceptInvitationView
      dependencies={{ acceptInvitation: acceptWithBetterAuth, router }}
      invitationId={invitationId}
    />
  );
};

export { AcceptInvitation, AcceptInvitationView };

export type { AcceptInvitationDependencies };
