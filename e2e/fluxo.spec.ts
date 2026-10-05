import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tudo que o teste cria leva este prefixo e é apagado no fim, mesmo se o teste falhar.
const SUFIXO = `${Date.now()}`;
const PREFIXO = `E2E ${SUFIXO}`;
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function gerarCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const digito = (nums: number[]) => {
    const soma = nums.reduce((s, n, i) => s + n * (nums.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(base);
  return [...base, d1, digito([...base, d1])].join("");
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await db.from("eventos").delete().like("nome", `${PREFIXO}%`);
  await db.from("participantes").delete().like("nome", `${PREFIXO}%`);
  await db.from("empresas").delete().like("nome", `${PREFIXO}%`);
});

test("cadastro, inscrição, PDF e check-in", async ({ page, request }, info) => {
  const tag = `${PREFIXO} ${info.project.name}`;
  const cpf = gerarCpf();

  // Empresa, e a mesma de novo (com outra caixa) para ver a mensagem de duplicada
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} Acme`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/empresas$/);
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} ACME`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Já existe uma empresa com esse nome")).toBeVisible();

  // Participante
  await page.goto("/participantes/novo");
  await page.getByLabel("Nome").fill(`${tag} José Conceição`);
  await page.getByLabel("CPF ou documento").fill(cpf);
  await page.getByLabel("Empresa").selectOption({ label: `${tag} Acme` });
  await page.getByLabel("Tipo").selectOption("vip");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/participantes$/);

  // Busca por CPF formatado e por nome sem acento
  await page.goto(`/participantes?q=${cpf.slice(0, 3)}.${cpf.slice(3, 6)}`);
  await expect(page.getByText(`${tag} José Conceição`)).toBeVisible();
  await page.goto(`/participantes?q=${encodeURIComponent(`${tag} jose conceicao`)}`);
  await expect(page.getByText(`${tag} José Conceição`)).toBeVisible();

  // Empresa com participante não apaga
  await page.goto(`/empresas?q=${encodeURIComponent(`${tag} Acme`)}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Não dá para apagar")).toBeVisible();

  // Dois eventos: o QR do primeiro precisa ser recusado no segundo
  const criarEvento = async (nome: string) => {
    await page.goto("/eventos/novo");
    await page.getByLabel("Nome do evento").fill(nome);
    await page.getByLabel("Tipo").selectOption("kickoff");
    await page.getByLabel("Data").fill(hoje);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);
    return page.url().split("/").pop()!;
  };
  const outroId = await criarEvento(`${tag} Outro`);
  const eventoId = await criarEvento(`${tag} Kickoff`);

  // Inscrever
  await page.getByRole("link", { name: "Inscrever participantes" }).click();
  await page.getByLabel("Buscar participante").fill(cpf);
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByLabel(new RegExp(`${tag} José Conceição`)).check();
  await page.getByRole("button", { name: "Inscrever selecionados" }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  await expect(page.getByLabel("Presentes sobre inscritos")).toHaveText("0/1");

  const linha = page.getByRole("row", { name: new RegExp(`${tag} José Conceição`) });
  const codigo = (await linha.locator(".font-mono").innerText()).trim();
  expect(codigo).toMatch(/^[A-Za-z0-9_-]{22}$/);

  // PDF individual e ZIP
  const pdfHref = await linha.getByRole("link", { name: "PDF" }).getAttribute("href");
  const pdf = await request.get(pdfHref!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const zip = await request.get(`/eventos/${eventoId}/zip`);
  expect(zip.headers()["content-type"]).toBe("application/zip");

  // Check-in pelo campo de código: verde, depois amarelo, desconhecido e outro evento
  await page.goto("/checkin");
  await page.getByLabel("Evento").selectOption(eventoId);
  const validar = async (c: string) => {
    await page.getByLabel("Código do QR").fill(c);
    await page.getByRole("button", { name: "Validar" }).click();
  };
  await validar(codigo);
  await expect(page.getByText("Check-in feito · entregar crachá")).toBeVisible();
  await page.waitForTimeout(3100); // a mesma leitura em menos de 3 s é ignorada de propósito
  await validar(codigo);
  await expect(page.getByText(/Já fez check-in às/)).toBeVisible();
  await validar("codigo-que-nao-existe");
  await expect(page.getByText("Código não encontrado")).toBeVisible();
  await page.getByLabel("Evento").selectOption(outroId);
  await validar(codigo);
  await expect(page.getByText("QR de outro evento")).toBeVisible();

  await page.goto(`/eventos/${eventoId}`);
  await expect(page.getByLabel("Presentes sobre inscritos")).toHaveText("1/1");
});
