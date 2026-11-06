const NAV_ROUTES = [
  { href: "/", label: "Chat" },
  { href: "/empresa", label: "Empresa" },
  { href: "/assets", label: "Assets" },
  { href: "/activity", label: "Atividade" },
] as const;

const PROTECTED_ROUTES: ReadonlyArray<string> = [
  ...NAV_ROUTES.map(({ href }) => href),
  "/convite",
  "/no-access",
];

export { NAV_ROUTES, PROTECTED_ROUTES };
