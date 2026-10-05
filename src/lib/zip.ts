import { zipSync } from "fflate";
import { semAcento } from "./texto";

export function nomeArquivo(nome: string): string {
  const base = semAcento(nome).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return base || "participante";
}

// Dois "João Silva" no mesmo evento viram joao-silva.pdf e joao-silva-2.pdf.
export function montarZip(arquivos: { nome: string; conteudo: Uint8Array }[]): Uint8Array {
  const usados = new Map<string, number>();
  const entradas: Record<string, Uint8Array> = {};
  for (const a of arquivos) {
    const base = nomeArquivo(a.nome);
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    entradas[n === 1 ? `${base}.pdf` : `${base}-${n}.pdf`] = a.conteudo;
  }
  // PDF já é comprimido; level 0 só empacota.
  return zipSync(entradas, { level: 0 });
}
