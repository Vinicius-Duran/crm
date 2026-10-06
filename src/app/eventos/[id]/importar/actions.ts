"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { ehUuid } from "@/lib/dominio";
import { lerPlanilha, validarLinhas, type LinhaValidada } from "@/lib/planilha";
import { normalizarBusca } from "@/lib/texto";
import { gerarCodigo } from "@/lib/codigo";

// Vercel recusa corpo acima de 4,5 MB e o next.config libera 4 MB para Server Actions.
const LIMITE_BYTES = 3 * 1024 * 1024;
const FALHA_BANCO = "Não consegui consultar o evento. Tente de novo.";

export type Previa = { linhas: (LinhaValidada & { existente?: boolean })[]; novos: number; existentes: number; comErro: number };
type Erro = { ok: false; mensagem: string };
type Lida = Erro | { ok: true; linhas: LinhaValidada[] };

async function ler(eventoId: string, form: FormData): Promise<Lida> {
  if (!ehUuid(eventoId)) return { ok: false, mensagem: "Evento inválido" };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, mensagem: "Escolha um arquivo CSV ou Excel" };
  if (arquivo.size > LIMITE_BYTES) return { ok: false, mensagem: "Arquivo maior que 3 MB. Divida a planilha em partes." };
  try {
    const linhas = validarLinhas(lerPlanilha(new Uint8Array(await arquivo.arrayBuffer())));
    if (linhas.length === 0) return { ok: false, mensagem: "A planilha não tem linhas de dados" };
    return { ok: true, linhas };
  } catch {
    return { ok: false, mensagem: "Não consegui ler o arquivo. Use o modelo em CSV ou Excel." };
  }
}

// Documento -> código do QR de quem já está no evento. Lança se o banco falhar.
// .in() vai na URL; em fatias de 200 a URL fica abaixo do limite do PostgREST mesmo com milhares de linhas.
async function codigosNoEvento(eventoId: string, documentos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (let i = 0; i < documentos.length; i += 200) {
    const { data, error } = await db()
      .from("participantes")
      .select("documento, codigo")
      .eq("evento_id", eventoId)
      .in("documento", documentos.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const d of data) mapa.set(d.documento as string, d.codigo as string);
  }
  return mapa;
}

export async function previsualizar(eventoId: string, form: FormData): Promise<Erro | { ok: true; previa: Previa }> {
  const lida = await ler(eventoId, form);
  if (!lida.ok) return lida;
  let ja: Map<string, string>;
  try {
    ja = await codigosNoEvento(eventoId, lida.linhas.flatMap((l) => (l.ok ? [l.dados.documento] : [])));
  } catch {
    return { ok: false, mensagem: FALHA_BANCO };
  }
  const linhas = lida.linhas.map((l) => (l.ok ? { ...l, existente: ja.has(l.dados.documento) } : l));
  return {
    ok: true,
    previa: {
      linhas,
      novos: linhas.filter((l) => l.ok && !l.existente).length,
      existentes: linhas.filter((l) => l.ok && l.existente).length,
      comErro: linhas.filter((l) => !l.ok).length,
    },
  };
}

// Recebe o MESMO arquivo de novo e revalida no servidor: nada que veio da prévia no navegador é confiado.
// Quem já está no evento é atualizado e mantém o código (o QR pode já estar impresso) e o check-in,
// que não vão no upsert.
export async function importar(eventoId: string, form: FormData): Promise<{ ok: boolean; mensagem: string }> {
  const lida = await ler(eventoId, form);
  if (!lida.ok) return lida;
  const validos = lida.linhas.flatMap((l) => (l.ok ? [l.dados] : []));
  if (validos.length === 0) return { ok: false, mensagem: "Nenhuma linha válida para gravar" };
  let ja: Map<string, string>;
  try {
    ja = await codigosNoEvento(eventoId, validos.map((p) => p.documento));
  } catch {
    return { ok: false, mensagem: FALHA_BANCO };
  }

  // Sem .select() na volta: o PostgREST devolveria no máximo 1.000 linhas e a contagem sairia errada.
  const { error } = await db()
    .from("participantes")
    .upsert(
      validos.map((p) => ({ ...p, nome_busca: normalizarBusca(p.nome), evento_id: eventoId, codigo: ja.get(p.documento) ?? gerarCodigo() })),
      { onConflict: "evento_id,documento" },
    );
  if (error) return { ok: false, mensagem: `Erro ao gravar participantes: ${error.message}` };

  revalidatePath(`/eventos/${eventoId}`);
  const ignoradas = lida.linhas.length - validos.length;
  return { ok: true, mensagem: `${validos.length} participantes gravados${ignoradas ? `, ${ignoradas} linhas com erro ignoradas` : ""}` };
}
