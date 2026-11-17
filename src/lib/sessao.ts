import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { dbUsuario } from "./supabase";

export type Papel = "dono" | "barbeiro";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  adminPlataforma: boolean;
  conta: { id: string; nome: string; slug: string; modulos: string[] };
};

type LinhaConta = { id: string; nome: string; slug: string; modulos: string[] };
type LinhaUsuario = {
  id: string;
  nome: string;
  papel: Papel;
  admin_plataforma: boolean;
  contas: LinhaConta | LinhaConta[] | null;
};

// cache(): uma consulta só por requisição, mesmo com várias chamadas (layout, página, action).
// getUser() (não getClaims()) revalida com o servidor do Auth a cada pedido: getClaims() só
// decodifica o JWT local, que continua "válido" até expirar sozinho mesmo depois de o usuário ser
// desativado (ver src/proxy.ts) — sem isso, a conta banida continuaria vendo as páginas logadas.
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const banco = await dbUsuario();
  const { data: autenticado } = await banco.auth.getUser();
  if (!autenticado.user) return null;

  const { data } = await banco
    .from("usuarios")
    .select("id, nome, papel, admin_plataforma, contas(id, nome, slug, modulos)")
    .eq("id", autenticado.user.id)
    .maybeSingle<LinhaUsuario>();
  if (!data) return null;
  const conta = Array.isArray(data.contas) ? data.contas[0] : data.contas;
  if (!conta) return null;

  return {
    id: data.id,
    nome: data.nome,
    email: autenticado.user.email ?? "",
    papel: data.papel,
    adminPlataforma: data.admin_plataforma,
    conta: { id: conta.id, nome: conta.nome, slug: conta.slug, modulos: conta.modulos },
  };
});

export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/entrar");
  return usuario;
}

export async function exigirDono(): Promise<Usuario> {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "dono") notFound();
  return usuario;
}

export async function exigirAdmin(): Promise<Usuario> {
  const usuario = await exigirUsuario();
  if (!usuario.adminPlataforma) notFound();
  return usuario;
}
