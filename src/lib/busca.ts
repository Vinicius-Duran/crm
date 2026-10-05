import "server-only";
import { z } from "zod";
import { db } from "./supabase";
import { normalizarDocumento } from "./documento";
import { limparTermo } from "./texto";
import { TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";

export type ParticipanteListado = {
  id: string;
  nome: string;
  documento: string;
  email: string | null;
  telefone: string | null;
  tipo: TipoParticipante;
  empresa: { id: string; nome: string } | null;
};

export type FiltroParticipantes = { termo?: string; empresaId?: string; tipo?: string; limite?: number };

// Usada pela lista de participantes, pela tela de inscrever e pela busca manual do check-in.
// ponytail: limite fixo sem paginação; a tela pede para refinar a busca quando bate no limite.
export async function buscarParticipantes(f: FiltroParticipantes): Promise<ParticipanteListado[]> {
  let q = db()
    .from("participantes")
    .select("id, nome, documento, email, telefone, tipo, empresa:empresas(id, nome)")
    .order("nome_busca")
    .limit(f.limite ?? 200);
  const termo = limparTermo(f.termo ?? "");
  const documento = normalizarDocumento(f.termo ?? "");
  if (termo) {
    q = documento.length >= 3
      ? q.or(`nome_busca.ilike.%${termo}%,documento.ilike.%${documento}%`)
      : q.ilike("nome_busca", `%${termo}%`);
  }
  // Valor fora do domínio viraria erro de cast no Postgres; é ignorado.
  if (f.empresaId && z.uuid().safeParse(f.empresaId).success) q = q.eq("empresa_id", f.empresaId);
  if (f.tipo && f.tipo in TIPOS_PARTICIPANTE) q = q.eq("tipo", f.tipo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as unknown as ParticipanteListado[];
}

export async function listarEmpresas(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db().from("empresas").select("id, nome").order("nome");
  if (error) throw new Error(error.message);
  return data;
}
