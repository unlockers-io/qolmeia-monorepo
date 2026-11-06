import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const BackLink = ({ children, href }: { children: ReactNode; href: string }) => (
  <Link
    className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    href={href}
  >
    <ChevronLeft aria-hidden className="size-4" />
    {children}
  </Link>
);

export { BackLink };
