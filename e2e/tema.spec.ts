import { expect, test } from "@playwright/test";

// A lista de opções do <select> é desenhada pelo navegador. color-scheme: dark escurece o calendário
// e as barras de rolagem, mas o Chrome no Windows ainda desenha a lista branca com o texto claro
// herdado do tema; por isso a <option> leva fundo e texto do popover explícitos.
test("tema escuro deixa o dropdown legível", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tema", "escuro"));
  await page.goto("/eventos/novo");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const tipo = page.getByLabel("Tipo");
  expect(await tipo.evaluate((s) => getComputedStyle(s).colorScheme)).toBe("dark");
  const cores = await tipo.evaluate((s: HTMLSelectElement) => {
    const ref = document.createElement("div");
    ref.className = "bg-popover text-popover-foreground";
    document.body.append(ref);
    const esperado = getComputedStyle(ref);
    const opcao = getComputedStyle(s.options[0]);
    const r = { fundo: opcao.backgroundColor, texto: opcao.color, fundoEsperado: esperado.backgroundColor, textoEsperado: esperado.color };
    ref.remove();
    return r;
  });
  expect(cores.fundo).toBe(cores.fundoEsperado);
  expect(cores.texto).toBe(cores.textoEsperado);
});
