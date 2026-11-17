"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbServico } from "@/lib/supabase";
import { exigirAdmin } from "@/lib/sessao";
import { contaSchema, ehUuid, usuarioSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { alternarAtivoDe, criarUsuario, redefinirSenha } from "@/lib/usuarios";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

// dbServico ignora o RLS e enxerga todas as contas. Server Action aceita POST direto, sem passar pela
// página, por isso cada uma começa por exigirAdmin(), e não só a tela.

export async function salvarConta(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirAdmin();
  // Cada checkbox marcado chega como um valor de "modulos"; valoresDo guardaria só o último.
  const modulos = form.getAll("modulos");
  const valores: Record<string, string> = { ...valoresDo(form), modulos: modulos.join(",") };
  if (valores.id && !ehUuid(valores.id)) return { ok: false, mensagem: "Conta inválida", valores };
  const r = contaSchema.safeParse({ ...valores, modulos });
  if (!r.success) return errosDoZod(r.error, valores);
  const banco = dbServico();
  const { error } = valores.id
    ? await banco.from("contas").update(r.data).eq("id", valores.id)
    : await banco.from("contas").insert(r.data);
  if (error) return { ok: false, mensagem: mensagemErro(error, "Já existe uma conta com esse slug"), valores };
  revalidatePath("/admin/contas");
  redirect("/admin/contas");
}

export async function salvarUsuarioDaConta(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  await exigirAdmin();
  const valores = valoresDo(form);
  const contaId = valores.conta_id ?? "";
  if (!ehUuid(contaId)) return { ok: false, mensagem: "Conta inválida", valores };
  const r = usuarioSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  try {
    await criarUsuario({ ...r.data, contaId });
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : "Erro ao criar usuário", valores };
  }
  revalidatePath(`/admin/contas/${contaId}`);
  return { ok: true, mensagem: "Usuário criado" };
}

async function nomeDoUsuario(id: string): Promise<string | null> {
  if (!ehUuid(id)) return null;
  const { data } = await dbServico().from("usuarios").select("nome").eq("id", id).maybeSingle();
  return data?.nome ?? null;
}

export async function redefinirSenhaAdmin(id: string): Promise<EstadoAcao> {
  await exigirAdmin();
  const nome = await nomeDoUsuario(id);
  if (!nome) return { ok: false, mensagem: "Usuário não encontrado" };
  const senha = await redefinirSenha(id);
  revalidatePath("/admin/contas/[id]", "page");
  return { ok: true, mensagem: `Senha temporária de ${nome}: ${senha}. Anote: ela não aparece de novo.` };
}

export async function alternarAtivoAdmin(id: string): Promise<EstadoAcao> {
  const admin = await exigirAdmin();
  if (id === admin.id) return { ok: false, mensagem: "Você não pode desativar a si mesmo" };
  const nome = await nomeDoUsuario(id);
  if (!nome) return { ok: false, mensagem: "Usuário não encontrado" };
  const { desativado } = await alternarAtivoDe(id);
  revalidatePath("/admin/contas/[id]", "page");
  return { ok: true, mensagem: desativado ? `${nome} desativado` : `${nome} reativado` };
}
