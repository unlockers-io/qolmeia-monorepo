import { getSignupState } from "@repo/app-shell/signup";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { safeRedirectPath } from "@/lib/redirect-validation";

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
  const redirectTo = safeRedirectPath(from);

  return (
    <p className="text-center text-sm text-muted-foreground">
      Ainda não tem conta?{" "}
      <Link
        className="font-medium text-primary underline-offset-4 hover:underline"
        href={redirectTo === "/" ? "/register" : `/register?from=${encodeURIComponent(redirectTo)}`}
      >
        Criar conta
      </Link>
    </p>
  );
};

const LoginPage = ({ searchParams }: Props) => (
  <LoginForm
    registerPrompt={
      <Suspense>
        <RegisterPrompt searchParams={searchParams} />
      </Suspense>
    }
    searchParams={searchParams}
  />
);

export default LoginPage;
