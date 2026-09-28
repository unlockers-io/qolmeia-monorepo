import { Logo } from "@repo/ui/compositions/logo";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Verificando…",
};

const VerifyLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
    <div className="flex w-full max-w-md flex-col gap-6">
      <Link aria-label="Qolmeia" className="mx-auto transition-opacity hover:opacity-80" href="/">
        <Logo className="h-8 w-auto" />
      </Link>
      {children}
    </div>
  </div>
);

export default VerifyLayout;
