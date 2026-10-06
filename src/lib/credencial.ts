import "server-only";
import { db } from "./supabase";
import { formatarData, TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";
import type { DadosCredencial } from "./pdf";

export type Credencial = DadosCredencial & { participanteId: string; email: string | null };

type Linha = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoParticipante;
  email: string | null;
  empresa: string | null;
  evento: { nome: string; data: string };
};

const CAMPOS = "id, codigo, nome, tipo, email, empresa, evento:eventos(nome, data)";

// Fonte única dos dados que vão no PDF: rota do PDF, ZIP do evento e e-mail.
export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId: string }): Promise<Credencial[]> {
  const base = db().from("participantes").select(CAMPOS);
  const { data, error } = await ("ids" in filtro ? base.in("id", filtro.ids) : base.eq("evento_id", filtro.eventoId));
  if (error) throw new Error(error.message);
  return (data as unknown as Linha[])
    .map((l) => ({
      participanteId: l.id,
      email: l.email,
      nome: l.nome,
      tipo: TIPOS_PARTICIPANTE[l.tipo],
      empresa: l.empresa,
      evento: l.evento.nome,
      data: formatarData(l.evento.data),
      codigo: l.codigo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
