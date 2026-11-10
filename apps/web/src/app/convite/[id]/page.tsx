import { SignOutButton } from "@repo/app-shell/sign-out-button";
import { MAIN_CONTENT_ID } from "@repo/app-shell/skip-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInvitation } from "./accept-invitation";

export const metadata: Metadata = {
  title: "Convite",
};

/** @public Next.js reads this segment config; the invitation id comes from the request. */
export const instant = false;

type InvitationPageProps = {
  params: Promise<{ id: string }>;
};

const InvitationAction = async ({ params }: InvitationPageProps) => {
  const { id } = await params;

  return <AcceptInvitation invitationId={id} />;
};

const InvitationPage = (props: InvitationPageProps) => (
  <main
    className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
    id={MAIN_CONTENT_ID}
  >
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Você foi convidado</h1>
        </CardTitle>
        <CardDescription>
          A equipe Qolmeia convidou você para o time de agentes da sua empresa. Aceite para começar
          a conversar com eles.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Suspense fallback={null}>
          <InvitationAction {...props} />
        </Suspense>
        <SignOutButton className="w-full" label="Entrar com outra conta" />
      </CardContent>
    </Card>
  </main>
);

export default InvitationPage;
