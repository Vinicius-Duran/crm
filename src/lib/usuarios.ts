import "server-only";
import { dbServico } from "./supabase";
import { gerarSenhaTemporaria } from "./senha";
import type { Papel } from "./sessao";

type UsuarioAuth = { banned_until?: string | null };

export function estaDesativado(u: UsuarioAuth): boolean {
  return !!u.banned_until;
}

export async function criarUsuario(d: {
  nome: string;
  email: string;
  senha: string;
  papel: Papel;
  contaId: string;
  adminPlataforma?: boolean;
}): Promise<{ id: string }> {
  const banco = dbServico();
  const { data, error } = await banco.auth.admin.createUser({ email: d.email, password: d.senha, email_confirm: true });
  if (error) throw new Error("Já existe um usuário com esse e-mail");
  const { error: erroUsuario } = await banco
    .from("usuarios")
    .insert({ id: data.user.id, conta_id: d.contaId, nome: d.nome, papel: d.papel, admin_plataforma: d.adminPlataforma ?? false });
  if (erroUsuario) {
    await banco.auth.admin.deleteUser(data.user.id);
    throw new Error(erroUsuario.message);
  }
  return { id: data.user.id };
}

export async function redefinirSenha(id: string): Promise<string> {
  const senha = gerarSenhaTemporaria();
  const { error } = await dbServico().auth.admin.updateUserById(id, { password: senha });
  if (error) throw new Error(error.message);
  return senha;
}

export async function desativarUsuario(id: string): Promise<void> {
  const { error } = await dbServico().auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (error) throw new Error(error.message);
}

export async function reativarUsuario(id: string): Promise<void> {
  const { error } = await dbServico().auth.admin.updateUserById(id, { ban_duration: "none" });
  if (error) throw new Error(error.message);
}

// A Server Action que alterna ativo/desativado (`alternarAtivo`, Task 4) só conhece o id: decidir a
// direção exige ler o estado atual no Auth, e só este arquivo pode chamar dbServico fora de admin/**.
export async function alternarAtivoDe(id: string): Promise<{ desativado: boolean }> {
  const banco = dbServico();
  const { data, error } = await banco.auth.admin.getUserById(id);
  if (error || !data.user) throw new Error("Usuário não encontrado");
  if (estaDesativado(data.user)) {
    await reativarUsuario(id);
    return { desativado: false };
  }
  await desativarUsuario(id);
  return { desativado: true };
}

// `/usuarios` lista nome, e-mail e estado por usuário da conta. `usuarios` não guarda e-mail
// (spec 1.1: a fonte é auth.users) nem o banimento (só o Auth sabe quem está desativado), então
// cada linha cruza a tabela com a API administrativa, pelo id.
export async function listarUsuariosDaConta(
  contaId: string,
): Promise<{ id: string; nome: string; email: string; papel: Papel; desativado: boolean }[]> {
  const banco = dbServico();
  const { data, error } = await banco.from("usuarios").select("id, nome, papel").eq("conta_id", contaId).order("nome");
  if (error) throw new Error(error.message);
  const linhas = data as unknown as { id: string; nome: string; papel: Papel }[];
  return Promise.all(
    linhas.map(async (u) => {
      const { data: autenticado } = await banco.auth.admin.getUserById(u.id);
      return {
        id: u.id,
        nome: u.nome,
        papel: u.papel,
        email: autenticado.user?.email ?? "",
        desativado: estaDesativado(autenticado.user ?? {}),
      };
    }),
  );
}
