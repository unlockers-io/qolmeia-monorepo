import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export class BackofficeLoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly formAlert: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel(/e-?mail/iu);
    this.passwordInput = page.getByLabel(/senha|password/iu);
    this.submitButton = page.getByRole("button", { name: /entrar|sign in/iu });
    this.formAlert = page.locator('[data-slot="form-alert"]');
  }

  goto = async () => {
    await this.page.goto("/login");
  };

  login = async (email: string, password: string) => {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  };

  expectDisabled = async () => {
    await expect(this.emailInput).toBeDisabled();
    await expect(this.passwordInput).toBeDisabled();
    await expect(this.submitButton).toBeDisabled();
  };

  expectFormAlert = async () => {
    await expect(this.formAlert).toBeVisible();
  };
}
