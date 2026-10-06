import { db } from "@/lib/supabase";
import { ehUuid } from "@/lib/dominio";
import { csvDoEvento, type EventoCsv, type ParticipanteCsv } from "@/lib/csv";
import { nomeArquivo } from "@/lib/zip";

// O PostgREST devolve no máximo 1.000 linhas por consulta; o CSV pede página a página até acabar.
const LOTE = 1000;

async function todosParticipantes(eventoId: string): Promise<ParticipanteCsv[]> {
  const todos: ParticipanteCsv[] = [];
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await db()
      .from("participantes")
      .select("nome, documento, data_nascimento, email, telefone, empresa, tipo, checkin_em")
      .eq("evento_id", eventoId)
      .order("nome_busca")
      .order("id")
      .range(de, de + LOTE - 1);
    if (error) throw new Error(error.message);
    todos.push(...(data as ParticipanteCsv[]));
    if (data.length < LOTE) return todos;
  }
}

// Tudo do evento numa planilha: empresa, evento e cada participante com presença e hora de chegada.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Evento não encontrado", { status: 404 });
  const { data: evento } = await db().from("eventos").select("nome, tipo, data, empresa:empresas(nome)").eq("id", id).maybeSingle();
  if (!evento) return new Response("Evento não encontrado", { status: 404 });
  const e = evento as unknown as Omit<EventoCsv, "empresa"> & { empresa: { nome: string } };
  const csv = csvDoEvento({ ...e, empresa: e.empresa.nome }, await todosParticipantes(id));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo(e.nome)}.csv"`,
    },
  });
}
