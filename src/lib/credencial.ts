import "server-only";
import { db } from "./supabase";
import { formatarData, TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";
import type { DadosCredencial } from "./pdf";

export type Credencial = DadosCredencial & { inscricaoId: string; email: string | null };

type Linha = {
  id: string;
  codigo: string;
  participante: { nome: string; tipo: TipoParticipante; email: string | null; empresa: { nome: string } | null };
  evento: { nome: string; data: string };
};

const CAMPOS = "id, codigo, participante:participantes(nome, tipo, email, empresa:empresas(nome)), evento:eventos(nome, data)";

// Fonte única dos dados que vão no PDF: rota do PDF, ZIP do evento e e-mail.
export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId: string }): Promise<Credencial[]> {
  const base = db().from("inscricoes").select(CAMPOS);
  const { data, error } = await ("ids" in filtro ? base.in("id", filtro.ids) : base.eq("evento_id", filtro.eventoId));
  if (error) throw new Error(error.message);
  return (data as unknown as Linha[])
    .map((l) => ({
      inscricaoId: l.id,
      email: l.participante.email,
      nome: l.participante.nome,
      tipo: TIPOS_PARTICIPANTE[l.participante.tipo],
      empresa: l.participante.empresa?.nome ?? null,
      evento: l.evento.nome,
      data: formatarData(l.evento.data),
      codigo: l.codigo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
