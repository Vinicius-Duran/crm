"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { ehUuid, participanteSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { gerarCodigo } from "@/lib/codigo";
import { normalizarBusca } from "@/lib/texto";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarParticipante(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const eventoId = valores.evento_id ?? "";
  if (!ehUuid(eventoId)) return { ok: false, mensagem: "Evento inválido", valores };
  const r = participanteSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const linha = { ...r.data, nome_busca: normalizarBusca(r.data.nome) };
  // Editar nunca troca o evento nem o código do QR, que pode já estar impresso.
  const { error } = valores.id
    ? await db().from("participantes").update(linha).eq("id", valores.id).eq("evento_id", eventoId)
    : await db().from("participantes").insert({ ...linha, evento_id: eventoId, codigo: gerarCodigo() });
  if (error) {
    if (error.code === "23505") {
      const { data: dono } = await db().from("participantes").select("nome").eq("evento_id", eventoId).eq("documento", r.data.documento).maybeSingle();
      const mensagem = `Documento já cadastrado neste evento para ${dono?.nome ?? "outro participante"}`;
      return { ok: false, mensagem, erros: { documento: [mensagem] }, valores };
    }
    return { ok: false, mensagem: mensagemErro(error), valores };
  }
  revalidatePath(`/eventos/${eventoId}`);
  redirect(`/eventos/${eventoId}`);
}

export async function apagarParticipante(id: string, eventoId: string): Promise<EstadoAcao> {
  const { error } = await db().from("participantes").delete().eq("id", id).eq("evento_id", eventoId);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath(`/eventos/${eventoId}`);
  return { ok: true, mensagem: "Participante removido" };
}
