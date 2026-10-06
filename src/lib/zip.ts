import { unzipSync, zipSync } from "fflate";
import { semAcento } from "./texto";

// Credenciais por pedido do ZIP do evento. 500 PDFs dão ~1,5 MB e ~6 s (medido em 2026-10-06);
// a Vercel recusa resposta acima de 4,5 MB.
export const LOTE_ZIP = 500;

export function nomeArquivo(nome: string): string {
  const base = semAcento(nome).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return base || "participante";
}

// Dois "João Silva" no mesmo evento viram joao-silva.pdf e joao-silva-2.pdf. Procura o próximo nome
// livre em vez de contar: "João", "João" e "João 2" disputariam joao-2.pdf.
export function montarZip(arquivos: { nome: string; conteudo: Uint8Array }[]): Uint8Array {
  const entradas: Record<string, Uint8Array> = {};
  for (const a of arquivos) {
    const base = nomeArquivo(a.nome);
    let nome = `${base}.pdf`;
    for (let n = 2; nome in entradas; n++) nome = `${base}-${n}.pdf`;
    entradas[nome] = a.conteudo;
  }
  // PDF já é comprimido; level 0 só empacota.
  return zipSync(entradas, { level: 0 });
}

// Roda no navegador: o ZIP de um evento grande chega em lotes (a Vercel não devolve resposta acima de
// 4,5 MB) e vira um arquivo só. Homônimo vindo de outro lote ganha o próximo número livre.
export function juntarZips(partes: Uint8Array[]): Uint8Array {
  const entradas: Record<string, Uint8Array> = {};
  for (const parte of partes) {
    for (const [nome, conteudo] of Object.entries(unzipSync(parte))) {
      let livre = nome;
      for (let n = 2; livre in entradas; n++) livre = nome.replace(/(-\d+)?\.pdf$/, `-${n}.pdf`);
      entradas[livre] = conteudo;
    }
  }
  return zipSync(entradas, { level: 0 });
}
