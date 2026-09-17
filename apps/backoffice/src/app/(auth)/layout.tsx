import { Logo } from "@repo/ui/compositions/logo";
import Link from "next/link";
import type { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
    <div className="flex w-full max-w-md flex-col gap-6">
      <Link aria-label="Qolmeia" className="mx-auto transition-opacity hover:opacity-80" href="/">
        <Logo className="h-8 w-auto" />
      </Link>
      {children}
      <p className="mx-auto text-xs text-muted-foreground">Painel operacional</p>
    </div>
  </div>
);

export default AuthLayout;
