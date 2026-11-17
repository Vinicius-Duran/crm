import { createClient } from "@supabase/supabase-js";

// Cria (ou atualiza, se o e-mail já existir) o administrador da plataforma: dono da conta vm-events
// com admin_plataforma. A migração não cria usuário e /admin exige login, então o primeiro acesso
// nasce aqui, com a chave service_role e sem passar pelo app (roda sem build).
// Uso: npm run primeiro-admin -- <email> <senha> [nome]

function falhar(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

const email = process.argv[2]?.trim().toLowerCase();
const senha = process.argv[3];
if (!email || !senha) falhar("Uso: npm run primeiro-admin -- <email> <senha> [nome]");
if (senha.length < 8) falhar("A senha precisa ter pelo menos 8 caracteres.");

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) falhar("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (no .env.local ou no ambiente).");

const banco = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: conta, error: erroConta } = await banco.from("contas").select("id").eq("slug", "vm-events").maybeSingle();
if (erroConta) falhar(`Não foi possível ler a conta vm-events: ${erroConta.message}`);
if (!conta) falhar("A conta vm-events não existe nesse banco. Aplique as migrações de supabase/migrations antes.");

// A API administrativa não busca por e-mail: percorre as páginas até achar.
async function idPorEmail(): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await banco.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) falhar(`Não foi possível listar os usuários: ${error.message}`);
    const achado = data.users.find((u) => u.email === email);
    if (achado) return achado.id;
    if (data.users.length < 1000) return undefined;
  }
}

let id = await idPorEmail();
const existia = !!id;
if (id) {
  const { error } = await banco.auth.admin.updateUserById(id, { password: senha });
  if (error) falhar(`Não foi possível trocar a senha: ${error.message}`);
} else {
  const { data, error } = await banco.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error) falhar(`Não foi possível criar o usuário: ${error.message}`);
  id = data.user.id;
}

// Sem nome na linha de comando, mantém o que já estava gravado.
const { data: atual } = await banco.from("usuarios").select("nome").eq("id", id).maybeSingle();
const nome = process.argv[4]?.trim() || atual?.nome || "Administrador";
const { error: erroUsuario } = await banco.from("usuarios").upsert({ id, conta_id: conta.id, nome, papel: "dono", admin_plataforma: true });
// O usuário do Auth já existe nesse ponto: rodar de novo encontra pelo e-mail e refaz esta gravação.
if (erroUsuario) falhar(`Usuário ${email} existe no Auth, mas não foi possível gravar em usuarios: ${erroUsuario.message}. Rode de novo.`);

console.log(`${existia ? "Atualizado" : "Criado"}: ${email} (${nome}) é dono da conta vm-events e administrador da plataforma. Entre em /entrar.`);
