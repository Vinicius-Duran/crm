import { ehUuid } from "@/lib/dominio";
import { carregarCredenciais } from "@/lib/credencial";
import { gerarCredencialPdf } from "@/lib/pdf";
import { montarZip, nomeArquivo } from "@/lib/zip";
import { db } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Evento não encontrado", { status: 404 });
  const { data: evento } = await db().from("eventos").select("nome").eq("id", id).maybeSingle();
  if (!evento) return new Response("Evento não encontrado", { status: 404 });
  const credenciais = await carregarCredenciais({ eventoId: id });
  if (credenciais.length === 0) return new Response("Nenhum inscrito neste evento", { status: 404 });
  const arquivos = [];
  for (const c of credenciais) arquivos.push({ nome: c.nome, conteudo: await gerarCredencialPdf(c) });
  return new Response(Buffer.from(montarZip(arquivos)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeArquivo(evento.nome)}.zip"`,
    },
  });
}
