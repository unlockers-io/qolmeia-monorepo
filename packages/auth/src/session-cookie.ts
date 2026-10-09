import { getSessionCookie } from "better-auth/cookies";

const AUTH_COOKIE_PREFIX = "qolmeia";

const hasSessionCookie = (headers: Headers): boolean =>
  getSessionCookie(headers, { cookiePrefix: AUTH_COOKIE_PREFIX }) !== null;

export { AUTH_COOKIE_PREFIX, hasSessionCookie };
