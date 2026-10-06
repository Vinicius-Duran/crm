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
  nome: string;
  tipo: TipoParticipante;
  empresa: string | null;
  evento: { nome: string };
};

const CAMPOS = "id, evento_id, checkin_em, nome, tipo, empresa, evento:eventos(nome)";

export async function checkinPorCodigo(codigo: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const limpo = codigo.trim();
  return limpo ? registrar("codigo", limpo, eventoId) : { status: "desconhecido" };
}

export async function checkinPorParticipante(participanteId: string, eventoId: string | null): Promise<ResultadoCheckin> {
  return ehUuid(participanteId) ? registrar("id", participanteId, eventoId) : { status: "desconhecido" };
}

async function registrar(coluna: "codigo" | "id", valor: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const { data, error } = await db().from("participantes").select(CAMPOS).eq(coluna, valor).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { status: "desconhecido" };
  const l = data as unknown as Linha;
  if (eventoId && l.evento_id !== eventoId) return { status: "outro_evento", nome: l.nome, evento: l.evento.nome };

  const base = { nome: l.nome, tipo: TIPOS_PARTICIPANTE[l.tipo], empresa: l.empresa, evento: l.evento.nome };
  // Um único UPDATE condicionado a checkin_em vazio: dois celulares no mesmo QR dão um "ok" e um "repetido".
  const { data: marcadas, error: e2 } = await db()
    .from("participantes")
    .update({ checkin_em: new Date().toISOString() })
    .eq("id", l.id)
    .is("checkin_em", null)
    .select("checkin_em");
  if (e2) throw new Error(e2.message);
  revalidatePath(`/eventos/${l.evento_id}`);
  if (marcadas.length) return { status: "ok", ...base, checkinEm: marcadas[0].checkin_em as string };

  const { data: atual } = await db().from("participantes").select("checkin_em").eq("id", l.id).single();
  return { status: "repetido", ...base, checkinEm: (atual?.checkin_em as string | undefined) ?? l.checkin_em ?? "" };
}

export type Inscrito = { participanteId: string; nome: string; documento: string; empresa: string | null; evento: string; checkinEm: string | null };

// Busca manual: para quem chega sem QR legível.
export async function buscarInscritos(termo: string, eventoId: string | null): Promise<Inscrito[]> {
  const encontrados = await buscarParticipantes({ termo, eventoId });
  return encontrados.map((p) => ({ participanteId: p.id, nome: p.nome, documento: p.documento, empresa: p.empresa, evento: p.evento.nome, checkinEm: p.checkin_em }));
}
