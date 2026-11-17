import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { apagarDadosDeTeste, criarContaDeTeste, criarUsuarioDeTeste, entrar } from "./sessao";

const PREFIXO = `E2E ${Date.now()} admin`;
// A conta que o admin cria pela tela leva o nome do critério ("E2E Barbearia <sufixo>"), com um
// prefixo próprio para a limpeza achar a conta e o dono dela.
const PREFIXO_CONTA = `E2E Barbearia ${Date.now()}`;
const EMPRESA_DA_PLATAFORMA = `${PREFIXO} Empresa`;

test.describe.configure({ mode: "serial" });

let admin: { email: string; senha: string };
let outroDono: { email: string; senha: string };

test.beforeAll(async () => {
  const { contaId } = await criarContaDeTeste(PREFIXO, ["eventos"]);
  admin = await criarUsuarioDeTeste(PREFIXO, contaId, { adminPlataforma: true, nome: "Admin E2E" });
  outroDono = await criarUsuarioDeTeste(PREFIXO, contaId, { nome: "Outro Dono E2E" });
  // Uma empresa na conta do admin: a lista vazia do dono novo só prova o isolamento se houver o que vazar.
  const banco = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error } = await banco.from("empresas").insert({ nome: EMPRESA_DA_PLATAFORMA, conta_id: contaId });
  if (error) throw error;
});

test.afterAll(async () => {
  await apagarDadosDeTeste(PREFIXO);
  await apagarDadosDeTeste(PREFIXO_CONTA);
});

// No celular o menu é uma gaveta: abre antes de procurar o que há nele (ver login.spec.ts).
async function abrirMenu(page: Page, info: TestInfo) {
  if (info.project.name === "celular") await page.getByRole("button", { name: "Recolher menu" }).click();
}

const slug = (texto: string) => texto.toLowerCase().replace(/[^a-z0-9]+/g, "-");

test("admin cria conta e dono; o dono entra sem ver a plataforma nem os dados dela", async ({ page }, info) => {
  const nomeConta = `${PREFIXO_CONTA} ${info.project.name}`;
  const emailDono = `e2e-${slug(PREFIXO_CONTA)}-dono-${info.project.name}@exemplo.test`;
  const senhaDono = "senha-do-dono-99";

  // Admin vê "Plataforma" e chega às contas pelo menu
  await entrar(page, admin.email, admin.senha);
  await abrirMenu(page, info);
  await expect(page.getByText("Plataforma", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Contas" }).click();
  await expect(page).toHaveURL(/\/admin\/contas$/);
  await expect(page.getByRole("button", { name: /apagar/i })).toHaveCount(0);

  // Cria a conta: o slug sai do nome sozinho
  await page.getByRole("link", { name: "Nova conta" }).click();
  await page.getByLabel("Nome").fill(nomeConta);
  await expect(page.getByLabel("Slug")).toHaveValue(slug(nomeConta));
  await page.getByRole("checkbox", { name: "Eventos" }).check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/admin\/contas$/);

  // Cria o dono dela
  await page.getByRole("link", { name: nomeConta }).click();
  await expect(page.getByRole("button", { name: /apagar/i })).toHaveCount(0);
  const novoUsuario = page.locator("form").filter({ has: page.getByRole("button", { name: "Criar usuário" }) });
  await novoUsuario.getByLabel("Nome").fill("Dono da Barbearia E2E");
  await novoUsuario.getByLabel("E-mail").fill(emailDono);
  await expect(novoUsuario.getByLabel("Papel")).toHaveValue("dono");
  await novoUsuario.getByLabel("Senha inicial").fill(senhaDono);
  await novoUsuario.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByRole("row", { name: emailDono })).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();

  // O dono entra, vê a própria conta e "Gestão", e nada da plataforma
  await entrar(page, emailDono, senhaDono);
  await expect(page).toHaveURL(/\/eventos$/);
  await abrirMenu(page, info);
  await expect(page.getByText(nomeConta, { exact: true })).toBeVisible();
  await expect(page.getByText("Gestão", { exact: true })).toBeVisible();
  await expect(page.getByText("Plataforma", { exact: true })).toHaveCount(0);
  if (info.project.name === "celular") await page.keyboard.press("Escape");

  const resposta = await page.goto("/admin/contas");
  expect(resposta?.status()).toBe(404);

  await page.goto("/empresas");
  await expect(page.getByText("Nenhuma empresa encontrada.")).toBeVisible();
  await expect(page.getByText(EMPRESA_DA_PLATAFORMA)).toHaveCount(0);
});

test("dono não vê ações sobre o administrador da plataforma da própria conta", async ({ page }) => {
  await entrar(page, outroDono.email, outroDono.senha);
  await page.goto("/usuarios");
  const linhaAdmin = page.getByRole("row", { name: admin.email });
  await expect(linhaAdmin.getByText("Administrador da plataforma")).toBeVisible();
  await expect(linhaAdmin.getByRole("button")).toHaveCount(0);
  // As outras linhas continuam com as ações
  await expect(page.getByRole("row", { name: outroDono.email }).getByRole("button", { name: "Redefinir senha" })).toBeVisible();
});
