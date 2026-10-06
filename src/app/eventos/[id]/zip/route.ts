import { ehUuid } from "@/lib/dominio";
import { carregarCredenciais } from "@/lib/credencial";
import { gerarCredencialPdf } from "@/lib/pdf";
import { LOTE_ZIP, montarZip } from "@/lib/zip";

// Um lote do ZIP do evento: ?lote=0, 1, 2… O navegador pede todos e junta (baixar-zip.tsx).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Evento não encontrado", { status: 404 });
  const param = new URL(req.url).searchParams.get("lote") ?? "0";
  if (!/^\d+$/.test(param)) return new Response("Lote inválido", { status: 400 });
  const de = Number(param) * LOTE_ZIP;
  const credenciais = await carregarCredenciais({ eventoId: id, de, ate: de + LOTE_ZIP - 1 });
  if (credenciais.length === 0) return new Response("Nenhum participante neste lote", { status: 404 });
  const arquivos = [];
  for (const c of credenciais) arquivos.push({ nome: c.nome, conteudo: await gerarCredencialPdf(c) });
  return new Response(Buffer.from(montarZip(arquivos)), { headers: { "Content-Type": "application/zip" } });
}
