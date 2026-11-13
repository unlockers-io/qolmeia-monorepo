const apps = {
  agents: { name: "qolmeia.agents", port: 8787 },
  backoffice: { name: "qolmeia.backoffice", port: 3000 },
  landing: { name: "qolmeia.landing", port: 3002 },
  web: { name: "qolmeia.web", port: 3001 },
} as const;

const urlEnv = {
  AGENTS_INTERNAL_URL: ["agents"],
  BACKOFFICE_URL: ["backoffice"],
  CORS_ORIGINS: ["web", "backoffice"],
  NEXT_PUBLIC_LANDING_URL: ["landing"],
  NEXT_PUBLIC_WEB_APP_URL: ["web"],
  WEB_APP_URL: ["web"],
  WORKER_PUBLIC_URL: ["agents"],
} as const satisfies Record<string, ReadonlyArray<keyof typeof apps>>;

export { apps, urlEnv };
