"use client";

import { matchesRoute } from "@repo/app-shell/match-route";
import { SignOutButton } from "@repo/app-shell/sign-out-button";
import { Logo } from "@repo/ui/compositions/logo";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { NAV_ROUTES } from "@/lib/routes";

const getInitials = (name: string): string =>
  name
    .split(/\s+/v)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.at(0)?.toUpperCase() ?? "")
    .join("") || "Q";

type NavProps = {
  orgName: string;
};

type NavDependencies = {
  pathname: string;
  SignOutControl: ComponentType<{ className?: string }>;
};

const NavView = ({ dependencies, orgName }: NavProps & { dependencies: NavDependencies }) => {
  const { pathname, SignOutControl } = dependencies;

  return (
    <header
      aria-label="Navegação principal"
      className="sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 border-b border-border bg-card px-4 md:h-14 md:flex-nowrap md:px-5"
    >
      <Link
        aria-label="Qolmeia"
        className="order-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center transition-opacity hover:opacity-80"
        href="/"
      >
        <Logo className="h-6 w-auto" />
      </Link>
      <nav className="order-3 -mx-4 w-nav-bleed overflow-x-auto border-t border-border px-4 py-2 md:order-2 md:mx-0 md:w-auto md:border-0 md:p-0">
        <ul className="flex min-w-max items-center gap-1">
          {NAV_ROUTES.map((item) => {
            const active = matchesRoute(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-highlight-surface font-semibold text-primary"
                      : "font-medium text-muted-foreground hover:text-foreground",
                  )}
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="order-2 ml-auto flex items-center gap-3 md:order-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="hidden truncate text-sm font-semibold text-foreground sm:inline">
            {orgName}
          </span>
          <span
            aria-hidden
            className="flex size-7.5 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white navigation-avatar"
          >
            {getInitials(orgName)}
          </span>
        </div>
        <SignOutControl className="min-h-11" />
      </div>
    </header>
  );
};

const Nav = (props: NavProps) => {
  const pathname = usePathname();

  return <NavView {...props} dependencies={{ pathname, SignOutControl: SignOutButton }} />;
};

export { Nav, NavView };

export type { NavDependencies };
