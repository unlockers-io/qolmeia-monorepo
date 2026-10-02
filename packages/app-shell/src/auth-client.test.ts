import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./auth-client";

describe("authErrorMessage", () => {
  it("translates known Better Auth codes to pt-BR", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, "fallback")).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("uses the caller's fallback for codes without a translation", () => {
    expect(authErrorMessage({ code: "FAILED_TO_CREATE_SESSION" }, "Tente novamente.")).toBe(
      "Tente novamente.",
    );
  });

  it("explains rate limiting regardless of code", () => {
    expect(authErrorMessage({ status: 429 }, "fallback")).toBe(
      "Muitas tentativas. Aguarde um instante e tente de novo.",
    );
  });
});
