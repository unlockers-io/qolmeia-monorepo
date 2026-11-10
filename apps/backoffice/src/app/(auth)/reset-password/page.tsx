import { buttonVariants } from "@repo/ui/components/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SkeletonBox } from "skullet/react";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha",
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

const InvalidLink = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-2xl">
        <h1>Link inválido ou expirado</h1>
      </CardTitle>
      <CardDescription>Solicite um novo link de redefinição para continuar.</CardDescription>
    </CardHeader>
    <CardFooter className="flex flex-col gap-3">
      <Link className={cn(buttonVariants({ size: "lg" }), "w-full")} href="/recover">
        Solicitar novo link
      </Link>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/login">
          Voltar para o login
        </Link>
      </p>
    </CardFooter>
  </Card>
);

const ResetPassword = async ({ searchParams }: Props) => {
  const { token } = await searchParams;

  return token === undefined || token === "" ? (
    <InvalidLink />
  ) : (
    <ResetPasswordForm token={token} />
  );
};

const ResetPasswordPage = ({ searchParams }: Props) => (
  <Suspense fallback={<SkeletonBox height={320} radius="0.75rem" width="100%" />}>
    <ResetPassword searchParams={searchParams} />
  </Suspense>
);

export default ResetPasswordPage;
