import { describe, expect, it } from "vitest";

import { hasSessionCookie } from "./session-cookie";

const withCookie = (cookie: string) => new Headers({ cookie });

describe("hasSessionCookie", () => {
  it("finds the session cookie issued over https", () => {
    expect(hasSessionCookie(withCookie("__Secure-qolmeia.session_token=tok.sig"))).toBe(true);
  });

  it("finds the session cookie issued over http", () => {
    expect(hasSessionCookie(withCookie("qolmeia.session_token=tok.sig"))).toBe(true);
  });

  it("ignores other cookies", () => {
    expect(hasSessionCookie(withCookie("qolmeia.session_data=x; theme=dark"))).toBe(false);
    expect(hasSessionCookie(new Headers())).toBe(false);
  });
});
