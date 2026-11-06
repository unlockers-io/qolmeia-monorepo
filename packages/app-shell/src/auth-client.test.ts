import { describe, expect, it } from "vitest";

import { authErrorMessage, authRequest } from "./auth-client";

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

describe("authRequest", () => {
  it("hands back the result of a call that succeeded", async () => {
    const result = { data: { token: "t" }, error: null };
    await expect(authRequest(() => Promise.resolve(result), "fallback")).resolves.toEqual({
      error: null,
      result,
    });
  });

  it("translates the error of a call that failed and keeps its status", async () => {
    const failure = { error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } };
    await expect(authRequest(() => Promise.resolve(failure), "fallback")).resolves.toEqual({
      error: "E-mail ou senha incorretos.",
      status: 401,
    });
  });

  it("explains a call that never reached the server", async () => {
    await expect(
      authRequest(() => Promise.reject(new TypeError("fetch failed")), "fallback"),
    ).resolves.toEqual({ error: "Não foi possível conectar ao servidor. Tente novamente." });
  });
});
