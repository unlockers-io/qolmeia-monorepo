import { expect, test } from "@playwright/test";

import { backofficeUrl } from "../../../playwright.config";
import { holdScripts } from "../helpers/hold-scripts";

test.describe("Backoffice template form", () => {
  test("keeps the form disabled until it hydrates", async ({ page }) => {
    await page.context().addCookies([{ name: "e2e-role", url: backofficeUrl, value: "OWNER" }]);
    const displayName = page.getByLabel("Nome de exibição");
    const workerKind = page.getByLabel("Tipo (worker kind)");
    const description = page.getByLabel("Descrição");
    const systemPrompt = page.getByLabel("Prompt do sistema");
    const model = page.getByLabel("Modelo (LLM)");
    const submitButton = page.getByRole("button", { name: "Criar modelo" });

    const releaseScripts = await holdScripts(page);
    await page.goto("/templates/new", { waitUntil: "commit" });
    await expect(displayName).toBeDisabled();
    await expect(workerKind).toBeDisabled();
    await expect(description).toBeDisabled();
    await expect(systemPrompt).toBeDisabled();
    await expect(model).toBeDisabled();
    await expect(submitButton).toBeDisabled();

    releaseScripts();
    await displayName.fill("Pesquisador de SEO");
    await workerKind.fill("seo-researcher");
    await description.fill("Pesquisa palavras-chave e concorrentes.");
    await systemPrompt.fill("Você pesquisa palavras-chave para o time.");
    await model.fill("openai/gpt-6.1-sol");
    await submitButton.click();

    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toBeVisible();
  });
});
