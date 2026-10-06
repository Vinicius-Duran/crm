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
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);

  const baixar = async () => {
    setProgresso({ feitos: 0, total });
    try {
      const partes: Uint8Array[] = [];
      // O total vem de cada lote (X-Total), não da página, que pode estar aberta há horas.
      let atual: number | null = null;
      let mudou = false;
      let feitos = 0;
      for (let lote = 0; atual === null || lote * LOTE_ZIP < atual; lote++) {
        const r = await fetch(`/eventos/${eventoId}/zip?lote=${lote}`);
        const doLote = Number(r.headers.get("X-Total"));
        if (atual !== null && doLote !== atual) mudou = true;
        atual ??= doLote;
        if (r.status === 404) break;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        partes.push(new Uint8Array(await r.arrayBuffer()));
        feitos = Math.min((lote + 1) * LOTE_ZIP, atual);
        setProgresso({ feitos, total: atual });
      }
      if (partes.length === 0) return void toast.error("Nenhum participante neste evento.");
      const url = URL.createObjectURL(new Blob([juntarZips(partes) as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomeArquivo(nome)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      // Lotes por posição: participante incluído ou removido no meio desloca os seguintes.
      if (mudou || feitos < (atual ?? 0)) toast.warning("A lista de participantes mudou durante o download. Baixe de novo para ter o ZIP completo.");
    } catch {
      toast.error("Não consegui gerar o ZIP. Tente de novo.");
    } finally {
      setProgresso(null);
    }
  };

  const texto = progresso ? `Gerando PDFs… ${numero(progresso.feitos)} de ${numero(progresso.total)}` : "Baixar PDFs (ZIP)";
  return (
    <>
      <Button type="button" variant="outline" disabled={total === 0 || progresso !== null} onClick={baixar}>
        {texto}
      </Button>
      <span role="status" className="sr-only">
        {progresso ? texto : ""}
      </span>
    </>
  );
}
