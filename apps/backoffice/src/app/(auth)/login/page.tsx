import { SignedInRedirect } from "@repo/app-shell/signed-in-redirect";
import { withFrom } from "@repo/auth/redirect-path";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getSignupState } from "@/lib/signup";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const RegisterPrompt = async ({ searchParams }: Props) => {
  const { open } = await getSignupState();

  if (!open) {
    return null;
  }

  const { from } = await searchParams;

  return (
    <p className="text-center text-sm text-muted-foreground">
      Ainda não tem conta?{" "}
      <Link
        className="font-medium text-primary underline-offset-4 hover:underline"
        href={withFrom("/register", from)}
      >
        Criar conta
      </Link>
    </p>
  );
};

const LoginPage = ({ searchParams }: Props) => (
  <>
    <SignedInRedirect />
    <LoginForm
      registerPrompt={
        <Suspense>
          <RegisterPrompt searchParams={searchParams} />
        </Suspense>
      }
      searchParams={searchParams}
    />
  </>
);

export default LoginPage;
