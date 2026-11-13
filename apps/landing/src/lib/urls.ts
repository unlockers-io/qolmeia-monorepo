import { origins } from "@repo/identity";

const SITE_URL = (URL.parse(process.env.NEXT_PUBLIC_LANDING_URL ?? "") ?? new URL(origins.landing))
  .origin;

const WEB_APP_URL = process.env.NEXT_PUBLIC_WEB_APP_URL ?? origins.web;

const webAppUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  return `${WEB_APP_URL}${normalized}`;
};

export { SITE_URL, webAppUrl };
