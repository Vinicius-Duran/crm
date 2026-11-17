import { expect, test } from "@playwright/test";
import { apagarDadosDeTeste, criarContaDeTeste, criarUsuarioDeTeste } from "./sessao";

const PREFIXO = `E2E ${Date.now()} login`;

test.describe.configure({ mode: "serial" });

let email: string;
let senha: string;

test.beforeAll(async () => {
  const { contaId } = await criarContaDeTeste(PREFIXO, ["eventos"]);
  const usuario = await criarUsuarioDeTeste(PREFIXO, contaId);
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

test("sair volta para /entrar e /eventos exige login de novo", async ({ page }) => {
  await page.goto("/entrar");
  await preencherEEntrar(page, email, senha);
  await expect(page).toHaveURL(/\/eventos$/);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/eventos");
  await expect(page).toHaveURL("/entrar?proximo=%2Feventos");
});
