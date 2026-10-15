const apps = {
  agents: { name: "qolmeia.agents", port: 8787 },
  backoffice: { name: "qolmeia.backoffice", port: 3000 },
  landing: { name: "qolmeia.landing", port: 3002 },
  web: { name: "qolmeia.web", port: 3001 },
} as const;

type App = keyof typeof apps;

const urlEnv = {
  AGENTS_INTERNAL_URL: ["agents"],
  BACKOFFICE_URL: ["backoffice"],
  CORS_ORIGINS: ["web", "backoffice"],
  NEXT_PUBLIC_LANDING_URL: ["landing"],
  NEXT_PUBLIC_WEB_APP_URL: ["web"],
  WEB_APP_URL: ["web"],
  WORKER_PUBLIC_URL: ["agents"],
} as const satisfies Record<string, ReadonlyArray<App>>;

type UrlEnvKey = keyof typeof urlEnv;

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1"] as const;

type LoopbackHostname = (typeof LOOPBACK_HOSTNAMES)[number];

const canonicalHostname = (app: App): string => `${apps[app].name}.localhost`;

const canonicalUrl = (app: App): string => `https://${canonicalHostname(app)}`;

const canonicalUrls = (key: UrlEnvKey): Array<string> => urlEnv[key].map(canonicalUrl);

const loopbackOrigin = (hostname: LoopbackHostname, port: number): string =>
  `http://${hostname}:${port}`;

const loopbackUrl = (app: App, hostname: LoopbackHostname): string =>
  loopbackOrigin(hostname, apps[app].port);

const loopbackOrigins = Object.values(apps).flatMap(({ port }) =>
  LOOPBACK_HOSTNAMES.map((hostname) => loopbackOrigin(hostname, port)),
);

// Portless serves every app, worktree-prefixed or not, on :443 or on its unprivileged fallback port.
const localHostPatterns = [
  "**.localhost",
  "**.localhost:*",
  ...LOOPBACK_HOSTNAMES.map((hostname) => `${hostname}:*`),
];

export {
  apps,
  canonicalHostname,
  canonicalUrl,
  canonicalUrls,
  localHostPatterns,
  loopbackOrigins,
  loopbackUrl,
  urlEnv,
};
export type { App, UrlEnvKey };
