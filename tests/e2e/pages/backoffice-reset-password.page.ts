import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export class BackofficeResetPasswordPage {
  private readonly heading: Locator;
  private readonly passwordInput: Locator;
  private readonly confirmPasswordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorToast: Locator;
  private readonly successToast: Locator;
  private readonly invalidLinkHeading: Locator;
  private readonly requestNewLink: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.locator('[data-slot="card-title"]').filter({
      hasText: /redefinir senha|reset password/iu,
    });
    this.passwordInput = page.getByLabel(/^nova senha$|^new password$/iu);
    this.confirmPasswordInput = page.getByLabel(/confirmar nova senha|confirm.*password/iu);
    this.submitButton = page.getByRole("button", { name: /redefinir senha|reset password/iu });
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');
    this.invalidLinkHeading = page.getByRole("heading", { name: /link inválido ou expirado/iu });
    this.requestNewLink = page.getByRole("link", { name: /solicitar novo link/iu });
  }

  goto = async (token?: string) => {
    const path = token ? `/reset-password?token=${encodeURIComponent(token)}` : "/reset-password";
    await this.page.goto(path);
  };

  submit = async (password: string, confirmPassword: string) => {
    await this.passwordInput.pressSequentially(password);
    await this.confirmPasswordInput.pressSequentially(confirmPassword);
    await this.submitButton.click();
  };

  expectHeadingVisible = async () => {
    await expect(this.heading).toBeVisible();
  };

  expectErrorToast = async () => {
    await expect(this.errorToast).toBeVisible();
  };

  expectInvalidLinkVisible = async () => {
    await expect(this.invalidLinkHeading).toBeVisible();
    await expect(this.requestNewLink).toHaveAttribute("href", "/recover");
  };
}
