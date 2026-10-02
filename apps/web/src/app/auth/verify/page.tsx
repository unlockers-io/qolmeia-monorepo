import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Entrando",
};

/** @public Next.js reads this segment config; the magic-link callback normally redirects, so it may block. */
export const instant = false;

type VerifyPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const VerifyContent = async ({ searchParams }: VerifyPageProps) => {
  const { error } = await searchParams;
  if (error === undefined || error === "") {
    redirect("/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          <h1>Não conseguimos entrar</h1>
        </CardTitle>
        <CardDescription>
          O link mágico expirou ou já foi usado. Solicite um novo no login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground" role="alert">
          {error}
        </p>
      </CardContent>
    </Card>
  );
};

const VerifyPage = (props: VerifyPageProps) => (
  <main
    className="flex min-h-dvh items-center justify-center bg-background px-4 py-12"
    id="main-content"
  >
    <div className="w-full max-w-md">
      <Suspense fallback={null}>
        <VerifyContent {...props} />
      </Suspense>
    </div>
  </main>
);

export default VerifyPage;
