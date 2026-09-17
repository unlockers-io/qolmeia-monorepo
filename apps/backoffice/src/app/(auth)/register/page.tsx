import { getSignupState, SIGNUP_CLOSED_MESSAGE } from "@repo/app-shell/signup";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Criar conta",
};

type Props = {
  searchParams: Promise<{ from?: string }>;
};

const RegistrationClosed = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-2xl">
        <h2>Cadastro encerrado</h2>
      </CardTitle>
      <CardDescription>{SIGNUP_CLOSED_MESSAGE}</CardDescription>
    </CardHeader>
    <CardFooter className="justify-center">
      <p className="text-center text-sm text-muted-foreground">
        <Link className="font-medium text-primary underline-offset-4 hover:underline" href="/login">
          Voltar para o login
        </Link>
      </p>
    </CardFooter>
  </Card>
);

const Registration = async ({ searchParams }: Props) => {
  const { open } = await getSignupState();
  return open ? <RegisterForm searchParams={searchParams} /> : <RegistrationClosed />;
};

const RegisterPage = ({ searchParams }: Props) => (
  <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
    <Registration searchParams={searchParams} />
  </Suspense>
);

export default RegisterPage;
