const NAV_ROUTES = [
  { href: "/", label: "Início" },
  { href: "/approvals", label: "Aprovações" },
  { href: "/tickets", label: "Tickets" },
  { href: "/teams", label: "Times" },
  { href: "/templates", label: "Modelos" },
  { href: "/activity", label: "Atividade" },
  { href: "/cobertura", label: "Cobertura" },
] as const;

type NavHref = (typeof NAV_ROUTES)[number]["href"];

const PROTECTED_ROUTES: ReadonlyArray<string> = NAV_ROUTES.map(({ href }) => href);

export { NAV_ROUTES, PROTECTED_ROUTES };

export type { NavHref };
