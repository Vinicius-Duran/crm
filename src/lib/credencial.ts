import "server-only";
import { db } from "./supabase";
import { formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "./dominio";
import type { DadosCredencial } from "./pdf";

export type Credencial = DadosCredencial & { participanteId: string; email: string | null };

type Linha = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoParticipante;
  email: string | null;
  empresa: string | null;
  evento: { nome: string; tipo: TipoEvento; data: string; empresa: { nome: string } };
};

const CAMPOS = "id, codigo, nome, tipo, email, empresa, evento:eventos(nome, tipo, data, empresa:empresas(nome))";

// Fonte única dos dados que vão no PDF: rota do PDF, ZIP do evento e e-mail.
// Por evento, vem uma faixa [de, ate] (inclusiva) na ordem do nome: o PostgREST devolve no máximo
// 1.000 linhas, e o ZIP pede o evento em lotes.
export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId: string; de: number; ate: number }): Promise<Credencial[]> {
  const base = db().from("participantes").select(CAMPOS).order("nome_busca").order("id");
  const { data, error } = await ("ids" in filtro ? base.in("id", filtro.ids) : base.eq("evento_id", filtro.eventoId).range(filtro.de, filtro.ate));
  if (error) throw new Error(error.message);
  return (data as unknown as Linha[]).map((l) => ({
      participanteId: l.id,
      email: l.email,
      nome: l.nome,
      tipo: TIPOS_PARTICIPANTE[l.tipo],
      empresa: l.empresa,
      empresaCliente: l.evento.empresa.nome,
      evento: l.evento.nome,
      tipoEvento: TIPOS_EVENTO[l.evento.tipo],
      data: formatarData(l.evento.data),
      codigo: l.codigo,
    }));
}
