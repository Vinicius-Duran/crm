import { carregarCredenciais } from "@/lib/credencial";
import { ehUuid } from "@/lib/dominio";
import { gerarCredencialPdf } from "@/lib/pdf";
import { nomeArquivo } from "@/lib/zip";

// PDF de um participante; o id é o do participante.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Participante não encontrado", { status: 404 });
  const [c] = await carregarCredenciais({ ids: [id] });
  if (!c) return new Response("Participante não encontrado", { status: 404 });
  return new Response(Buffer.from(await gerarCredencialPdf(c)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo(c.nome)}.pdf"`,
    },
  });
}
