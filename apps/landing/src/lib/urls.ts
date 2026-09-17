const SITE_URL = (
  URL.parse(process.env.NEXT_PUBLIC_LANDING_URL ?? "") ?? new URL("https://www.qolmeia.com")
).origin;

const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://app.qolmeia.com";

const webAppUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${WEB_APP_URL}${normalized}`;
};

export { SITE_URL, webAppUrl };
