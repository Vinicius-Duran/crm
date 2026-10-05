"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { participanteSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { normalizarBusca } from "@/lib/texto";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarParticipante(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = participanteSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const linha = { ...r.data, nome_busca: normalizarBusca(r.data.nome), empresa_id: valores.empresa_id || null };
  const { error } = valores.id
    ? await db().from("participantes").update(linha).eq("id", valores.id)
    : await db().from("participantes").insert(linha);
  if (error) {
    if (error.code === "23505") {
      const { data: dono } = await db().from("participantes").select("nome").eq("documento", r.data.documento).maybeSingle();
      return { ok: false, mensagem: "Documento já cadastrado", erros: { documento: [`Documento já cadastrado para ${dono?.nome ?? "outro participante"}`] }, valores };
    }
    return { ok: false, mensagem: mensagemErro(error), valores };
  }
  revalidatePath("/participantes");
  redirect("/participantes");
}

export async function apagarParticipante(id: string): Promise<EstadoAcao> {
  const { error } = await db().from("participantes").delete().eq("id", id);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath("/participantes");
  return { ok: true, mensagem: "Participante apagado" };
}
