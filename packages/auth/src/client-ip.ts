import { constantTimeEqual } from "better-auth/crypto";

const CLIENT_IP_HEADER = "x-qolmeia-client-ip";
const PROXY_SECRET_HEADER = "x-qolmeia-proxy-secret";
const EDGE_CLIENT_IP_HEADER = "cf-connecting-ip";

type ForwardedClient = { clientIp: string; secret: string };

const forwardClientIp = (headers: Headers, { clientIp, secret }: ForwardedClient): Headers => {
  const forwarded = new Headers(headers);
  forwarded.set(CLIENT_IP_HEADER, clientIp);
  forwarded.set(PROXY_SECRET_HEADER, secret);
  return forwarded;
};

const isProxied = (headers: Headers, secret: string | undefined): boolean => {
  const presented = headers.get(PROXY_SECRET_HEADER);
  return (
    secret !== undefined &&
    secret !== "" &&
    presented !== null &&
    constantTimeEqual(presented, secret)
  );
};

/**
 * Rewrites CLIENT_IP_HEADER to the address Better Auth may rate-limit on: the one a Next app
 * forwarded alongside the proxy secret, otherwise the caller Cloudflare saw.
 */
const withClientIp = (request: Request, secret: string | undefined): Request => {
  const headers = new Headers(request.headers);
  const clientIp = isProxied(headers, secret)
    ? headers.get(CLIENT_IP_HEADER)
    : headers.get(EDGE_CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  if (clientIp === null || clientIp === "") {
    headers.delete(CLIENT_IP_HEADER);
  } else {
    headers.set(CLIENT_IP_HEADER, clientIp);
  }
  return new Request(request, { headers });
};

export { CLIENT_IP_HEADER, forwardClientIp, withClientIp };
