import { expect, test } from "@playwright/test";
import { apagarDadosDeTeste, criarContaDeTeste, criarUsuarioDeTeste } from "./sessao";

const PREFIXO = `E2E ${Date.now()} login`;
const NOME_USUARIO = "Fulano de Teste E2E";

test.describe.configure({ mode: "serial" });

let email: string;
let senha: string;

test.beforeAll(async () => {
  const { contaId } = await criarContaDeTeste(PREFIXO, ["eventos"]);
  const usuario = await criarUsuarioDeTeste(PREFIXO, contaId, { nome: NOME_USUARIO });
  email = usuario.email;
  senha = usuario.senha;
});

test.afterAll(async () => {
  await apagarDadosDeTeste(PREFIXO);
});

const preencherEEntrar = async (page: import("@playwright/test").Page, e: string, s: string) => {
  await page.getByLabel("E-mail").fill(e);
  await page.getByLabel("Senha").fill(s);
  await page.getByRole("button", { name: "Entrar" }).click();
};

test("sem sessão vai para /entrar e volta para a página pedida", async ({ page }) => {
  await page.goto("/eventos");
  await expect(page).toHaveURL("/entrar?proximo=%2Feventos");
  await preencherEEntrar(page, email, senha);
  await expect(page).toHaveURL(/\/eventos$/);
});

test("senha errada mostra a mensagem e mantém o e-mail", async ({ page }) => {
  await page.goto("/entrar");
  await preencherEEntrar(page, email, "senha-errada-123");
  await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
});

test("proximo externo cai na inicial", async ({ page }) => {
  await page.goto("/entrar?proximo=https://outro-site");
  await preencherEEntrar(page, email, senha);
  await expect(page).toHaveURL(/\/eventos$/);
});

test("sair volta para /entrar e /eventos exige login de novo", async ({ page }, testInfo) => {
  await page.goto("/entrar");
  await preencherEEntrar(page, email, senha);
  await expect(page).toHaveURL(/\/eventos$/);

  // No celular o menu é uma gaveta: abre para o cabeçalho (nome da conta) aparecer, e fecha de
  // volta com Esc antes de continuar — o fundo fica inert com a gaveta aberta, e o próprio
  // gatilho (fora da gaveta) não recebe mais clique para fechá-la de novo.
  if (testInfo.project.name === "celular") {
    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect(page.getByText(PREFIXO, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByText(PREFIXO, { exact: true })).toBeVisible();
  }

  // Nome do usuário só aparece a partir de `md`: visível no desktop, oculto no celular.
  const nomeUsuario = page.getByText(NOME_USUARIO, { exact: true });
  if (testInfo.project.name === "desktop") await expect(nomeUsuario).toBeVisible();
  else await expect(nomeUsuario).toBeHidden();

  const botaoSair = page.getByRole("button", { name: "Sair" });
  await expect(botaoSair).toBeVisible();
  await botaoSair.click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/eventos");
  await expect(page).toHaveURL("/entrar?proximo=%2Feventos");
});
