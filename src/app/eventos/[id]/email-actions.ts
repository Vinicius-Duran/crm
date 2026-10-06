"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { carregarCredenciais, type Credencial } from "@/lib/credencial";
import { emailConfigurado, enviarCredencial, type ResultadoEnvio } from "@/lib/email";
import { gerarCredencialPdf } from "@/lib/pdf";
import type { EstadoAcao } from "@/lib/acao";

const LOTE = 10;

// Cota esgotada não marca erro: o participante continua pendente e entra no lote de amanhã.
async function enviarERegistrar(c: Credencial): Promise<ResultadoEnvio> {
  const r = await enviarCredencial(c, await gerarCredencialPdf(c));
  if (r.ok) await db().from("participantes").update({ email_enviado_em: new Date().toISOString(), email_erro: null }).eq("id", c.participanteId);
  else if (!r.cotaEsgotada) await db().from("participantes").update({ email_erro: r.erro }).eq("id", c.participanteId);
  return r;
}

export async function enviarEmailParticipante(participanteId: string): Promise<EstadoAcao> {
  if (!emailConfigurado()) return { ok: false, mensagem: "Envio por e-mail não configurado" };
  const [c] = await carregarCredenciais({ ids: [participanteId] });
  if (!c) return { ok: false, mensagem: "Participante não encontrado" };
  const r = await enviarERegistrar(c);
  revalidatePath("/eventos/[id]", "page");
  return r.ok ? { ok: true, mensagem: `E-mail enviado para ${c.email}` } : { ok: false, mensagem: r.erro };
}

export type ResultadoLote = { enviados: number; falhas: number; restantes: number; cotaEsgotada: boolean };

// Um lote por chamada; o navegador chama de novo até restantes = 0. Cada chamada fica bem abaixo do
// limite de duração da função na Vercel, e o progresso aparece na tela entre um lote e outro.
export async function enviarLoteEmail(eventoId: string): Promise<ResultadoLote> {
  if (!emailConfigurado()) return { enviados: 0, falhas: 0, restantes: 0, cotaEsgotada: false };
  const pendentes = () =>
    db().from("participantes").select("id", { count: "exact" }).eq("evento_id", eventoId).is("email_enviado_em", null).is("email_erro", null);
  const { data, error } = await pendentes().limit(LOTE);
  if (error) throw new Error(error.message);
  const credenciais = data.length ? await carregarCredenciais({ ids: data.map((d) => d.id as string) }) : [];
  let enviados = 0;
  let falhas = 0;
  let cotaEsgotada = false;
  for (const c of credenciais) {
    const r = await enviarERegistrar(c);
    if (r.ok) enviados++;
    else if (r.cotaEsgotada) {
      cotaEsgotada = true;
      break;
    } else falhas++;
  }
  const { count } = await pendentes().limit(1);
  revalidatePath(`/eventos/${eventoId}`);
  return { enviados, falhas, restantes: count ?? 0, cotaEsgotada };
}
