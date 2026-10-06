"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { juntarZips, LOTE_ZIP, nomeArquivo } from "@/lib/zip";

const numero = (n: number) => n.toLocaleString("pt-BR");

// O ZIP de um evento grande não cabe numa resposta só da Vercel (4,5 MB): pede lote a lote, mostra o
// progresso e entrega um arquivo único. ponytail: o ZIP inteiro fica na memória do navegador
// (~3 KB por credencial, ~30 MB para 10.000); se passar de centenas de milhares, gravar em streaming.
export function BaixarZip({ eventoId, nome, total }: { eventoId: string; nome: string; total: number }) {
  const [feitos, setFeitos] = useState<number | null>(null);

  const baixar = async () => {
    setFeitos(0);
    try {
      const partes: Uint8Array[] = [];
      for (let lote = 0; lote * LOTE_ZIP < total; lote++) {
        const r = await fetch(`/eventos/${eventoId}/zip?lote=${lote}`);
        if (r.status === 404) break; // alguém removeu participantes durante o download
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        partes.push(new Uint8Array(await r.arrayBuffer()));
        setFeitos(Math.min((lote + 1) * LOTE_ZIP, total));
      }
      if (partes.length === 0) return void toast.error("Nenhum participante neste evento.");
      const url = URL.createObjectURL(new Blob([juntarZips(partes) as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomeArquivo(nome)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Não consegui gerar o ZIP. Tente de novo.");
    } finally {
      setFeitos(null);
    }
  };

  return (
    <Button type="button" variant="outline" disabled={total === 0 || feitos !== null} onClick={baixar} aria-live="polite">
      {feitos === null ? "Baixar PDFs (ZIP)" : `Gerando PDFs… ${numero(feitos)} de ${numero(total)}`}
    </Button>
  );
}
