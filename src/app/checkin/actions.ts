"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { buscarParticipantes } from "@/lib/busca";
import { ehUuid, TIPOS_PARTICIPANTE, type TipoParticipante } from "@/lib/dominio";

export type ResultadoCheckin =
  | { status: "ok" | "repetido"; nome: string; tipo: string; empresa: string | null; evento: string; checkinEm: string }
  | { status: "outro_evento"; nome: string; evento: string }
  | { status: "desconhecido" };

type Linha = {
  id: string;
  evento_id: string;
  checkin_em: string | null;
  participante: { nome: string; tipo: TipoParticipante; empresa: { nome: string } | null };
  evento: { nome: string };
};

const CAMPOS = "id, evento_id, checkin_em, participante:participantes(nome, tipo, empresa:empresas(nome)), evento:eventos(nome)";

export async function checkinPorCodigo(codigo: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const limpo = codigo.trim();
  return limpo ? registrar("codigo", limpo, eventoId) : { status: "desconhecido" };
}

export async function checkinPorInscricao(inscricaoId: string, eventoId: string | null): Promise<ResultadoCheckin> {
  return ehUuid(inscricaoId) ? registrar("id", inscricaoId, eventoId) : { status: "desconhecido" };
}

async function registrar(coluna: "codigo" | "id", valor: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const { data, error } = await db().from("inscricoes").select(CAMPOS).eq(coluna, valor).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { status: "desconhecido" };
  const l = data as unknown as Linha;
  if (eventoId && l.evento_id !== eventoId) return { status: "outro_evento", nome: l.participante.nome, evento: l.evento.nome };

  const base = { nome: l.participante.nome, tipo: TIPOS_PARTICIPANTE[l.participante.tipo], empresa: l.participante.empresa?.nome ?? null, evento: l.evento.nome };
  // Um único UPDATE condicionado a checkin_em vazio: dois celulares no mesmo QR dão um "ok" e um "repetido".
  const { data: marcadas, error: e2 } = await db()
    .from("inscricoes")
    .update({ checkin_em: new Date().toISOString() })
    .eq("id", l.id)
    .is("checkin_em", null)
    .select("checkin_em");
  if (e2) throw new Error(e2.message);
  revalidatePath(`/eventos/${l.evento_id}`);
  if (marcadas.length) return { status: "ok", ...base, checkinEm: marcadas[0].checkin_em as string };

  const { data: atual } = await db().from("inscricoes").select("checkin_em").eq("id", l.id).single();
  return { status: "repetido", ...base, checkinEm: (atual?.checkin_em as string | undefined) ?? l.checkin_em ?? "" };
}

export type Inscrito = { inscricaoId: string; nome: string; documento: string; empresa: string | null; evento: string; checkinEm: string | null };

// Busca manual: para quem chega sem QR legível.
export async function buscarInscritos(termo: string, eventoId: string | null): Promise<Inscrito[]> {
  if (termo.trim().length < 2) return [];
  const participantes = await buscarParticipantes({ termo, limite: 30 });
  if (participantes.length === 0) return [];
  let q = db()
    .from("inscricoes")
    .select("id, participante_id, checkin_em, evento:eventos(nome)")
    .in("participante_id", participantes.map((p) => p.id));
  if (eventoId) q = q.eq("evento_id", eventoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const porId = new Map(participantes.map((p) => [p.id, p]));
  return (data as unknown as { id: string; participante_id: string; checkin_em: string | null; evento: { nome: string } }[]).map((i) => {
    const p = porId.get(i.participante_id)!;
    return { inscricaoId: i.id, nome: p.nome, documento: p.documento, empresa: p.empresa?.nome ?? null, evento: i.evento.nome, checkinEm: i.checkin_em };
  });
}
