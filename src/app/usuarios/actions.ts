"use server";

import { revalidatePath } from "next/cache";
import { dbUsuario } from "@/lib/supabase";
import { exigirDono } from "@/lib/sessao";
import { usuarioSchema } from "@/lib/dominio";
import { criarUsuario, redefinirSenha, alternarAtivoDe } from "@/lib/usuarios";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

// Confere que o id pedido é um usuário da própria conta do dono, lendo por dbUsuario(): a política
// de RLS de `usuarios` já restringe a leitura à conta atual, então uma linha de outra conta não
// aparece aqui mesmo sem filtro extra.
async function usuarioDaConta(id: string): Promise<{ nome: string; admin_plataforma: boolean } | null> {
  const banco = await dbUsuario();
  const { data } = await banco.from("usuarios").select("nome, admin_plataforma").eq("id", id).maybeSingle();
  return data;
}

// Decisão do autor (#40): quem redefine a senha do administrador da plataforma entra em /admin, com
// acesso a todas as contas. Por isso o dono não redefine nem desativa esse usuário; a tela também
// esconde os botões, mas a recusa que vale é esta.
const PROTEGIDO = "O administrador da plataforma não pode ser alterado aqui";

export async function salvarUsuario(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const dono = await exigirDono();
  const valores = valoresDo(form);
  const r = usuarioSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  try {
    await criarUsuario({ ...r.data, contaId: dono.conta.id });
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Erro ao criar usuário", valores };
  }
  revalidatePath("/usuarios");
  return { ok: true, mensagem: "Usuário criado" };
}

export async function redefinirSenhaDe(id: string): Promise<EstadoAcao> {
  await exigirDono();
  const alvo = await usuarioDaConta(id);
  if (!alvo) return { ok: false, mensagem: "Usuário não encontrado" };
  if (alvo.admin_plataforma) return { ok: false, mensagem: PROTEGIDO };
  const senha = await redefinirSenha(id);
  revalidatePath("/usuarios");
  return { ok: true, mensagem: `Senha temporária de ${alvo.nome}: ${senha}. Anote: ela não aparece de novo.` };
}

export async function alternarAtivo(id: string): Promise<EstadoAcao> {
  const dono = await exigirDono();
  if (id === dono.id) return { ok: false, mensagem: "Você não pode desativar a si mesmo" };
  const alvo = await usuarioDaConta(id);
  if (!alvo) return { ok: false, mensagem: "Usuário não encontrado" };
  if (alvo.admin_plataforma) return { ok: false, mensagem: PROTEGIDO };
  const { desativado } = await alternarAtivoDe(id);
  revalidatePath("/usuarios");
  return { ok: true, mensagem: desativado ? `${alvo.nome} desativado` : `${alvo.nome} reativado` };
}
