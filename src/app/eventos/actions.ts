"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { eventoSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { gerarCodigo } from "@/lib/codigo";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarEvento(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = eventoSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const { data, error } = valores.id
    ? await db().from("eventos").update(r.data).eq("id", valores.id).select("id").single()
    : await db().from("eventos").insert(r.data).select("id").single();
  if (error) return { ok: false, mensagem: mensagemErro(error), valores };
  revalidatePath("/eventos");
  redirect(`/eventos/${data.id}`);
}

export async function apagarEvento(id: string): Promise<EstadoAcao> {
  const { error } = await db().from("eventos").delete().eq("id", id);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath("/eventos");
  redirect("/eventos");
}

// Form da tela "Inscrever": checkboxes name="participante". Já inscrito é ignorado (ignoreDuplicates).
export async function inscreverSelecionados(form: FormData): Promise<void> {
  const eventoId = String(form.get("evento_id"));
  const ids = form.getAll("participante").map(String);
  if (ids.length) {
    const { error } = await db()
      .from("inscricoes")
      .upsert(ids.map((id) => ({ participante_id: id, evento_id: eventoId, codigo: gerarCodigo() })), {
        onConflict: "participante_id,evento_id",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/eventos/${eventoId}`);
  redirect(`/eventos/${eventoId}`);
}

export async function removerInscricao(inscricaoId: string, eventoId: string): Promise<EstadoAcao> {
  const { error } = await db().from("inscricoes").delete().eq("id", inscricaoId);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath(`/eventos/${eventoId}`);
  return { ok: true, mensagem: "Inscrição removida" };
}
