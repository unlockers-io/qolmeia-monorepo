import { buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import { MAIN_CONTENT_ID } from "./skip-link";

const NotFound = ({ homeLabel }: { homeLabel: string }) => (
  <main
    className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center"
    id={MAIN_CONTENT_ID}
  >
    <p className="text-8xl font-bold tracking-tight text-foreground">404</p>
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-foreground">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        A página que você está procurando não existe ou foi movida.
      </p>
    </div>
    <Link className={cn(buttonVariants())} href="/">
      {homeLabel}
    </Link>
  </main>
);

export { NotFound };
