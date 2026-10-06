import { db } from "@/lib/supabase";
import { ehUuid } from "@/lib/dominio";
import { csvDoEvento, type EventoCsv, type ParticipanteCsv } from "@/lib/csv";
import { nomeArquivo } from "@/lib/zip";

// Tudo do evento numa planilha: empresa, evento e cada participante com presença e hora de chegada.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Evento não encontrado", { status: 404 });
  const [{ data: evento }, { data, error }] = await Promise.all([
    db().from("eventos").select("nome, tipo, data, empresa:empresas(nome)").eq("id", id).maybeSingle(),
    db()
      .from("participantes")
      .select("nome, documento, data_nascimento, email, telefone, empresa, tipo, checkin_em")
      .eq("evento_id", id)
      .order("nome_busca"),
  ]);
  if (!evento) return new Response("Evento não encontrado", { status: 404 });
  if (error) throw new Error(error.message);
  const e = evento as unknown as Omit<EventoCsv, "empresa"> & { empresa: { nome: string } };
  const csv = csvDoEvento({ ...e, empresa: e.empresa.nome }, data as ParticipanteCsv[]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo(e.nome)}.csv"`,
    },
  });
}
