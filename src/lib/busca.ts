import "server-only";
import { db } from "./supabase";
import { ehUuid } from "./dominio";
import { normalizarDocumento } from "./documento";
import { limparTermo } from "./texto";

export type ParticipanteEncontrado = {
  id: string;
  nome: string;
  documento: string;
  empresa: string | null;
  checkin_em: string | null;
  evento: { nome: string };
};

// Busca manual do check-in, para quem chega sem QR legível: nome sem acento ou parte do documento.
// Sem evento escolhido, procura em todos.
export async function buscarParticipantes(f: { termo: string; eventoId: string | null; limite?: number }): Promise<ParticipanteEncontrado[]> {
  const termo = limparTermo(f.termo);
  if (termo.length < 2) return [];
  const documento = normalizarDocumento(f.termo);
  let q = db()
    .from("participantes")
    .select("id, nome, documento, empresa, checkin_em, evento:eventos(nome)")
    .order("nome_busca")
    .limit(f.limite ?? 30);
  q = documento.length >= 3 ? q.or(`nome_busca.ilike.%${termo}%,documento.ilike.%${documento}%`) : q.ilike("nome_busca", `%${termo}%`);
  // Valor fora do domínio viraria erro de cast no Postgres; é ignorado.
  if (f.eventoId && ehUuid(f.eventoId)) q = q.eq("evento_id", f.eventoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as unknown as ParticipanteEncontrado[];
}

export async function listarEmpresas(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db().from("empresas").select("id, nome").order("nome");
  if (error) throw new Error(error.message);
  return data;
}
