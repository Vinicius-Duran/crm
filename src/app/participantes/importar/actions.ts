"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { lerPlanilha, validarLinhas, type DadosImportacao, type LinhaValidada } from "@/lib/planilha";
import { normalizarBusca } from "@/lib/texto";
import { gerarCodigo } from "@/lib/codigo";

// Vercel recusa corpo acima de 4,5 MB e o next.config libera 4 MB para Server Actions.
const LIMITE_BYTES = 3 * 1024 * 1024;

export type Previa = { linhas: (LinhaValidada & { existente?: boolean })[]; novos: number; existentes: number; comErro: number };
type Lida = { ok: false; mensagem: string } | { ok: true; linhas: LinhaValidada[] };

async function ler(form: FormData): Promise<Lida> {
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

export async function previsualizar(form: FormData): Promise<{ ok: false; mensagem: string } | { ok: true; previa: Previa }> {
  const lida = await ler(form);
  if (!lida.ok) return lida;
  const documentos = lida.linhas.flatMap((l) => (l.ok ? [l.dados.documento] : []));
  // .in() vai na URL; em fatias de 200 a URL fica abaixo do limite do PostgREST mesmo com milhares de linhas.
  const ja = new Set<string>();
  for (let i = 0; i < documentos.length; i += 200) {
    const { data, error } = await db().from("participantes").select("documento").in("documento", documentos.slice(i, i + 200));
    if (error) return { ok: false, mensagem: error.message };
    for (const d of data) ja.add(d.documento as string);
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
// ponytail: três escritas sem transação; reimportar é idempotente (upsert), então uma falha no meio se resolve repetindo.
export async function importar(form: FormData): Promise<{ ok: boolean; mensagem: string }> {
  const lida = await ler(form);
  if (!lida.ok) return lida;
  const validos = lida.linhas.flatMap((l) => (l.ok ? [l.dados] : []));
  if (validos.length === 0) return { ok: false, mensagem: "Nenhuma linha válida para gravar" };

  const empresaIds = await garantirEmpresas(validos);
  const { data: gravados, error } = await db()
    .from("participantes")
    .upsert(
      validos.map(({ empresa, ...p }) => ({ ...p, nome_busca: normalizarBusca(p.nome), empresa_id: empresa ? empresaIds.get(empresa.toLowerCase()) : null })),
      { onConflict: "documento" },
    )
    .select("id");
  if (error) return { ok: false, mensagem: `Erro ao gravar participantes: ${error.message}` };

  const eventoId = form.get("evento_id")?.toString();
  if (eventoId) {
    const { error: e2 } = await db()
      .from("inscricoes")
      .upsert(gravados.map((g) => ({ participante_id: g.id, evento_id: eventoId, codigo: gerarCodigo() })), {
        onConflict: "participante_id,evento_id",
        ignoreDuplicates: true,
      });
    if (e2) return { ok: false, mensagem: `Participantes gravados, mas a inscrição no evento falhou: ${e2.message}` };
    revalidatePath(`/eventos/${eventoId}`);
  }
  revalidatePath("/participantes");
  const ignoradas = lida.linhas.length - validos.length;
  return { ok: true, mensagem: `${gravados.length} participantes gravados${ignoradas ? `, ${ignoradas} linhas com erro ignoradas` : ""}` };
}

// Empresa vem pelo nome; cria as que faltam. Chave do mapa em minúsculas, como o índice único do banco.
async function garantirEmpresas(linhas: DadosImportacao[]): Promise<Map<string, string>> {
  const { data, error } = await db().from("empresas").select("id, nome");
  if (error) throw new Error(error.message);
  const mapa = new Map(data.map((e) => [(e.nome as string).toLowerCase(), e.id as string]));
  const faltando = new Map<string, string>();
  for (const l of linhas) if (l.empresa && !mapa.has(l.empresa.toLowerCase())) faltando.set(l.empresa.toLowerCase(), l.empresa);
  if (faltando.size) {
    const { data: novas, error: e2 } = await db().from("empresas").insert([...faltando.values()].map((nome) => ({ nome }))).select("id, nome");
    if (e2) throw new Error(e2.message);
    for (const e of novas) mapa.set((e.nome as string).toLowerCase(), e.id as string);
  }
  return mapa;
}
