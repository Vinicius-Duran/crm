import { z } from "zod";
import { carregarCredenciais } from "@/lib/credencial";
import { gerarCredencialPdf } from "@/lib/pdf";
import { nomeArquivo } from "@/lib/zip";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Inscrição não encontrada", { status: 404 });
  const [c] = await carregarCredenciais({ ids: [id] });
  if (!c) return new Response("Inscrição não encontrada", { status: 404 });
  return new Response(Buffer.from(await gerarCredencialPdf(c)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo(c.nome)}.pdf"`,
    },
  });
}
