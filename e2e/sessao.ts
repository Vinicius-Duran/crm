import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type Papel = "dono" | "barbeiro";

const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let contador = 0;

function slugDe(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function senhaAleatoria(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

export async function criarContaDeTeste(prefixo: string, modulos: string[] = ["eventos"]): Promise<{ contaId: string }> {
  const slug = `${slugDe(prefixo)}-${Date.now()}-${contador++}`.slice(0, 40);
  const { data, error } = await db().from("contas").insert({ nome: prefixo, slug, modulos }).select("id").single();
  if (error) throw error;
  return { contaId: data!.id as string };
}

export async function criarUsuarioDeTeste(
  prefixo: string,
  contaId: string,
  extra?: { papel?: Papel; adminPlataforma?: boolean; nome?: string },
): Promise<{ id: string; email: string; senha: string }> {
  const email = `e2e-${slugDe(prefixo)}-${contador++}@exemplo.test`;
  const senha = senhaAleatoria();
  const banco = db();
  const { data, error } = await banco.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) throw error;
  const { error: erroUsuario } = await banco
    .from("usuarios")
    .insert({ id: data.user.id, conta_id: contaId, nome: extra?.nome ?? prefixo, papel: extra?.papel ?? "dono", admin_plataforma: extra?.adminPlataforma ?? false });
  if (erroUsuario) throw erroUsuario;
  return { id: data.user.id, email, senha };
}

export async function entrar(page: Page, email: string, senha: string): Promise<void> {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  // Clique e navegação precisam ser aguardados juntos: sem isso, quem chama entrar() segue para a
  // próxima página antes do redirect do login terminar, e a sessão ainda não existe.
  await Promise.all([page.waitForURL((url) => url.pathname !== "/entrar"), page.getByRole("button", { name: "Entrar" }).click()]);
}

// Apaga pelo prefixo: usuários do Auth cujo e-mail leva "e2e-<prefixo>-" e as contas cujo nome
// começa com o prefixo. O cascade das migrações apaga o resto (usuarios, e na Tarefa 2 os dados).
export async function apagarDadosDeTeste(prefixo: string): Promise<void> {
  const banco = db();
  const inicioEmail = `e2e-${slugDe(prefixo)}-`;
  const { data } = await banco.auth.admin.listUsers();
  for (const u of data.users) {
    if (u.email?.startsWith(inicioEmail)) await banco.auth.admin.deleteUser(u.id);
  }
  await banco.from("contas").delete().like("nome", `${prefixo}%`);
}
