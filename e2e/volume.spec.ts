import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// O PostgREST devolve no máximo 1.000 linhas por consulta. Com 1.005 participantes, qualquer tela ou
// exportação que leia o evento de uma vez mostra 1.000 e erra os contadores.
const TOTAL = 1005;
const PREFIXO = `E2E ${Date.now()} volume`;
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function cpfs(n: number): string[] {
  const usados = new Set<string>();
  const digito = (nums: number[]) => {
    const resto = (nums.reduce((s, x, i) => s + x * (nums.length + 1 - i), 0) * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  while (usados.size < n) {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    if (base.every((d) => d === base[0])) continue;
    const d1 = digito(base);
    usados.add([...base, d1, digito([...base, d1])].join(""));
  }
  return [...usados];
}

test.afterAll(async () => {
  await db().from("eventos").delete().like("nome", `${PREFIXO}%`);
  await db().from("empresas").delete().like("nome", `${PREFIXO}%`);
});

test("evento com mais de 1.000 participantes: contadores, paginação de 20 e CSV completo", async ({ page, request }, info) => {
  test.setTimeout(240_000);
  const tag = `${PREFIXO} ${info.project.name}`;
  const { data: empresa } = await db().from("empresas").insert({ nome: `${tag} Acme` }).select("id").single();
  const { data: evento } = await db()
    .from("eventos")
    .insert({ nome: `${tag} Convenção`, tipo: "kickoff", data: "2026-12-01", empresa_id: empresa!.id })
    .select("id")
    .single();
  const eventoId = evento!.id as string;

  const linhas = cpfs(TOTAL).map((cpf, i) => `Pessoa ${String(i + 1).padStart(4, "0")};${cpf};Convidado`);
  await page.goto(`/eventos/${eventoId}/importar`);
  await page.getByLabel("Planilha (CSV ou Excel)").setInputFiles({
    name: "volume.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`nome;documento;tipo\n${linhas.join("\n")}\n`),
  });
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText(`${TOTAL} novos`)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: `Gravar ${TOTAL} participantes` }).click();
  await expect(page.getByText(`${TOTAL} participantes gravados`)).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));

  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("0/1.005");
  await expect(page.getByText("1–20 de 1.005 · página 1 de 51")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(21); // cabeçalho + 20
  await page.getByRole("link", { name: "Próxima" }).click();
  await expect(page.getByText("21–40 de 1.005 · página 2 de 51")).toBeVisible();
  await expect(page.getByRole("row", { name: /Pessoa 0021/ })).toBeVisible();

  // Página pedida além da última cai na última, que tem só 5.
  await page.goto(`/eventos/${eventoId}?pagina=999`);
  await expect(page.getByText("1.001–1.005 de 1.005 · página 51 de 51")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(6);

  const csv = await (await request.get(`/eventos/${eventoId}/csv`)).text();
  const dados = csv.split("\r\n").filter((l) => l.includes(`${tag} Convenção`));
  expect(dados).toHaveLength(TOTAL);
});
