import { forwardClientIp } from "@repo/internal-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const forwardAuthRequest = (request: NextRequest): NextResponse => {
  const clientIp = request.headers.get("x-forwarded-for") ?? "";
  const secret = process.env.TRUSTED_PROXY_SECRET ?? "";
  if (clientIp === "" || secret === "") {
    return NextResponse.next();
  }
  return NextResponse.next({
    request: { headers: forwardClientIp(request.headers, { clientIp, secret }) },
  });
};

export { forwardAuthRequest };
