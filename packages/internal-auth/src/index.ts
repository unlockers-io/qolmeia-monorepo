type VerifyResult = { kind: "disabled" } | { kind: "forbidden" } | { kind: "ok" };

const BEARER_PREFIX = "Bearer ";
const CLIENT_IP_HEADER = "x-qolmeia-client-ip";
const PROXY_SECRET_HEADER = "x-qolmeia-proxy-secret";

const constantTimeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
};

const readBearerToken = (header: string | null | undefined): string | null => {
  if (header === null || header === undefined || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return header.slice(BEARER_PREFIX.length);
};

/**
 * An unset `expected` disables the service instead of authenticating every request.
 * Callers keep "disabled" separate from "forbidden" for deployment diagnosis.
 */
const verifyInternalSecret = (input: {
  expected: string | undefined;
  header: string | null | undefined;
}): VerifyResult => {
  if (input.expected === undefined || input.expected === "") {
    return { kind: "disabled" };
  }
  const token = readBearerToken(input.header);
  if (token === null || !constantTimeEqual(token, input.expected)) {
    return { kind: "forbidden" };
  }
  return { kind: "ok" };
};

const forwardClientIp = (
  headers: Headers,
  input: { clientIp: string; secret: string },
): Headers => {
  const forwarded = new Headers(headers);
  forwarded.set(CLIENT_IP_HEADER, input.clientIp);
  forwarded.set(PROXY_SECRET_HEADER, input.secret);
  return forwarded;
};

const readForwardedClientIp = (headers: Headers, expected: string | undefined): string | null => {
  const presented = headers.get(PROXY_SECRET_HEADER);
  if (
    expected === undefined ||
    expected === "" ||
    presented === null ||
    !constantTimeEqual(presented, expected)
  ) {
    return null;
  }
  const clientIp = headers.get(CLIENT_IP_HEADER)?.trim() ?? "";
  return clientIp === "" ? null : clientIp;
};

export {
  constantTimeEqual,
  forwardClientIp,
  readBearerToken,
  readForwardedClientIp,
  verifyInternalSecret,
};
export type { VerifyResult };
