import { expect, test } from "@playwright/test";

// A lista de opções do <select> é desenhada pelo navegador, que só a escurece com color-scheme: dark.
// Sem isso, no tema escuro, o texto herda a cor clara e a lista sai branca: branco sobre branco.
test("tema escuro escurece os controles nativos", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tema", "escuro"));
  await page.goto("/eventos/novo");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.getByLabel("Tipo").evaluate((s) => getComputedStyle(s).colorScheme)).toBe("dark");
});
