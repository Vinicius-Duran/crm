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

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// O código do QR não aparece mais na tela do evento (a coluna é o documento); vem do banco.
async function codigoDe(eventoId: string, cpf: string): Promise<string> {
  const { data } = await db.from("participantes").select("codigo").eq("evento_id", eventoId).eq("documento", cpf).single();
  return data!.codigo as string;
}

test.afterAll(async () => {
  // Apagar o evento apaga os participantes dele (on delete cascade).
  await db.from("eventos").delete().like("nome", `${PREFIXO}%`);
  await db.from("empresas").delete().like("nome", `${PREFIXO}%`);
});

test("empresa, evento, participantes, importação, PDF, check-in e CSV", async ({ page, request }, info) => {
  const tag = `${PREFIXO} ${info.project.name}`;
  const cpf = gerarCpf();
  const cpfImportado = gerarCpf();

  // Empresa, e a mesma de novo (com outra caixa) para ver a mensagem de duplicada
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} Acme`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/empresas$/);
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} ACME`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Já existe uma empresa com esse nome")).toBeVisible();

  // Evento criado de dentro da empresa: a empresa já vem escolhida
  const criarEvento = async (nome: string) => {
    await page.goto(`/empresas?q=${encodeURIComponent(`${tag} Acme`)}`);
    await page.getByRole("link", { name: `${tag} Acme` }).click();
    await page.getByRole("link", { name: "Novo evento" }).click();
    await expect(page.getByLabel("Empresa", { exact: true })).toHaveValue(/[0-9a-f-]{36}/);
    await page.getByLabel("Nome do evento").fill(nome);
    await page.getByLabel("Tipo").selectOption("kickoff");
    await page.getByLabel("Data").fill(hoje);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);
    return page.url().split("/").pop()!;
  };
  const outroId = await criarEvento(`${tag} Outro`);
  const eventoId = await criarEvento(`${tag} Kickoff`);
  await expect(page.getByRole("link", { name: `${tag} Acme` })).toBeVisible();

  // Empresa com evento não apaga
  await page.goto(`/empresas?q=${encodeURIComponent(`${tag} Acme`)}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Não dá para apagar")).toBeVisible();

  // Participante adicionado à mão
  const adicionar = async (evento: string) => {
    await page.goto(`/eventos/${evento}`);
    await page.getByRole("link", { name: "Adicionar participante" }).click();
    await page.getByLabel("Nome").fill(`${tag} José Conceição`);
    await page.getByLabel("CPF ou documento").fill(cpf);
    await page.getByLabel("Empresa do participante").fill("Fornecedora Beta");
    await page.getByLabel("Tipo").selectOption("vip");
    await page.getByRole("button", { name: "Salvar" }).click();
  };
  await adicionar(eventoId);
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  // O mesmo CPF de novo no mesmo evento é recusado...
  await adicionar(eventoId);
  await expect(page.getByText(/Documento já cadastrado neste evento/).first()).toBeVisible();
  // ...e em outro evento é outro cadastro (o participante pertence ao evento)
  await adicionar(outroId);
  await expect(page).toHaveURL(new RegExp(`/eventos/${outroId}$`));

  // Importação de planilha dentro do evento
  await page.goto(`/eventos/${eventoId}/importar`);
  await page.getByLabel("Planilha (CSV ou Excel)").setInputFiles({
    name: "participantes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`nome;documento;tipo;empresa\n${tag} Ana Importada;${cpfImportado};Convidado;Gama\n`),
  });
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText("1 novos")).toBeVisible();
  await page.getByRole("button", { name: "Gravar 1 participantes" }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("0/2");

  const linha = page.getByRole("row", { name: new RegExp(`${tag} José Conceição`) });
  // A tabela mostra o documento formatado, não o código do QR.
  await expect(linha.getByText(`${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`)).toBeVisible();
  const codigo = await codigoDe(eventoId, cpf);
  expect(codigo).toMatch(/^[A-Za-z0-9_-]{22}$/);
  await expect(linha.getByText(codigo)).toHaveCount(0);

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
  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("1/2");

  // Reimportar quem já fez check-in atualiza os dados, mas mantém o QR impresso e a presença
  await page.goto(`/eventos/${eventoId}/importar`);
  await page.getByLabel("Planilha (CSV ou Excel)").setInputFiles({
    name: "reimportacao.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`nome;documento;tipo;empresa\n${tag} José Conceição;${cpf};VIP;Fornecedora Nova\n`),
  });
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText("1 já no evento")).toBeVisible();
  await page.getByRole("button", { name: "Gravar 1 participantes" }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("1/2");
  expect(await codigoDe(eventoId, cpf)).toBe(codigo);
  await expect(linha.getByText("Fornecedora Nova")).toBeVisible();

  // CSV do evento: quem veio tem Sim e a hora de chegada; quem não veio, Não
  const csv = await (await request.get(`/eventos/${eventoId}/csv`)).text();
  const linhas = csv.split("\r\n");
  expect(linhas.find((l) => l.includes("José Conceição"))).toMatch(
    new RegExp(`^${tag} Acme;${tag} Kickoff;Kickoff;.*;VIP;Sim;\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}$`),
  );
  expect(linhas.find((l) => l.includes("Ana Importada"))).toMatch(/;Gama;Convidado;Não;$/);
});
