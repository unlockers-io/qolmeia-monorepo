import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { webUrl } from "../../../playwright.config";

export class ClientLoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  private readonly magicLinkToggle: Locator;
  private readonly submitButton: Locator;
  private readonly sentHeading: Locator;
  private readonly formAlert: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel(/e-?mail/iu);
    this.passwordInput = page.getByLabel(/senha/iu);
    this.signInButton = page.getByRole("button", { exact: true, name: "Entrar" });
    this.magicLinkToggle = page.getByRole("button", { name: "Entrar com link mágico" });
    this.submitButton = page.getByRole("button", { name: /enviar link mágico|send magic link/iu });
    this.sentHeading = page.getByText(/verifique seu e-mail|check your email/iu);
    this.formAlert = page.locator('[data-slot="form-alert"]');
  }

  goto = async () => {
    await this.page.goto(`${webUrl}/login`);
  };

  signIn = async (email: string, password: string) => {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  };

  requestLink = async (email: string) => {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  };

  expectDisabled = async () => {
    await expect(this.emailInput).toBeDisabled();
    await expect(this.passwordInput).toBeDisabled();
    await expect(this.signInButton).toBeDisabled();
    await expect(this.magicLinkToggle).toBeDisabled();
  };

  expectSentState = async () => {
    await expect(this.sentHeading).toBeVisible();
  };

  expectFormAlert = async () => {
    await expect(this.formAlert).toBeVisible();
  };
}
