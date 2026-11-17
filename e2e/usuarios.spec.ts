import { expect, test } from "@playwright/test";
import { apagarDadosDeTeste, criarContaDeTeste, criarUsuarioDeTeste, entrar } from "./sessao";

const PREFIXO = `E2E ${Date.now()} usuarios`;
const SENHA_INICIAL = "senha-inicial-99";
const NOME_NOVO = "Fulano Novo E2E";

test.describe.configure({ mode: "serial" });

let emailDono: string;
let senhaDono: string;

test.beforeAll(async () => {
  const { contaId } = await criarContaDeTeste(PREFIXO, ["eventos"]);
  const dono = await criarUsuarioDeTeste(PREFIXO, contaId, { papel: "dono" });
  emailDono = dono.email;
  senhaDono = dono.senha;
});

test.afterAll(async () => {
  await apagarDadosDeTeste(PREFIXO);
});

test("dono cria usuário, redefine a senha e desativa; o novo troca a senha e perde o acesso", async ({ page, context }, info) => {
  // Cada projeto (desktop/celular) roda com a própria conta (criada no beforeAll), mas o e-mail do
  // usuário novo é escolhido aqui, à mão: precisa ser único entre os dois projetos.
  const emailNovo = `e2e-${PREFIXO.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-novo-${info.project.name}@exemplo.test`;

  await entrar(page, emailDono, senhaDono);
  await page.goto("/usuarios");

  // Dono cria o usuário novo
  await page.getByLabel("Nome").fill(NOME_NOVO);
  await page.getByLabel("E-mail").fill(emailNovo);
  await page.getByLabel("Papel").selectOption("dono");
  await page.getByLabel("Senha inicial").fill(SENHA_INICIAL);
  await page.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText(emailNovo)).toBeVisible();

  // O novo entra com a senha inicial e vê Eventos
  await page.getByRole("button", { name: "Sair" }).click();
  await entrar(page, emailNovo, SENHA_INICIAL);
  await expect(page).toHaveURL(/\/eventos$/);

  // Numa segunda aba, o novo continua logado: é a sessão que precisa cair depois de desativado.
  const segundaAba = await context.newPage();
  await segundaAba.goto("/eventos");
  await expect(segundaAba).toHaveURL(/\/eventos$/);

  await page.getByRole("button", { name: "Sair" }).click();

  // Dono redefine a senha do novo e lê a temporária na própria mensagem
  await entrar(page, emailDono, senhaDono);
  await page.goto("/usuarios");
  const linhaNovo = page.getByRole("row", { name: emailNovo });
  page.once("dialog", (d) => d.accept());
  await linhaNovo.getByRole("button", { name: "Redefinir senha" }).click();
  const aviso = page.getByText(new RegExp(`Senha temporária de ${NOME_NOVO}: `));
  await expect(aviso).toBeVisible();
  const senhaTemporaria = (await aviso.textContent())!.match(/: (\S+)\./)![1];
  await page.getByRole("button", { name: "Sair" }).click();

  // O novo entra com a senha temporária e troca em /minha-conta
  await entrar(page, emailNovo, senhaTemporaria);
  await page.goto("/minha-conta");
  await page.getByLabel("Nova senha").fill("senha-trocada-123");
  await page.getByLabel("Confirmar senha").fill("senha-trocada-123");
  await page.getByRole("button", { name: "Trocar senha" }).click();
  await expect(page.getByText("Senha alterada")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();

  // Dono desativa o novo
  await entrar(page, emailDono, senhaDono);
  await page.goto("/usuarios");
  const linhaNovo2 = page.getByRole("row", { name: emailNovo });
  page.once("dialog", (d) => d.accept());
  await linhaNovo2.getByRole("button", { name: "Desativar" }).click();
  await expect(page.getByText(`${NOME_NOVO} desativado`)).toBeVisible();

  // O desativado não entra mais, nem com a senha mais recente
  await page.getByRole("button", { name: "Sair" }).click();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(emailNovo);
  await page.getByLabel("Senha").fill("senha-trocada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos")).toBeVisible();

  // E a sessão antiga (a segunda aba, aberta antes de ele ser desativado) cai para /entrar
  await segundaAba.reload();
  await expect(segundaAba).toHaveURL(/\/entrar/);
});
