import { slug } from "@repo/identity";
import { getSessionCookie } from "better-auth/cookies";

const hasSessionCookie = (headers: Headers): boolean =>
  getSessionCookie(headers, { cookiePrefix: slug }) !== null;

export { hasSessionCookie };
