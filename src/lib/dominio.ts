import { z } from "zod";
import { validarDocumento } from "./documento";
import { semAcento } from "./texto";

export const TIPOS_PARTICIPANTE = {
  palestrante: "Palestrante",
  vip: "VIP",
  autoridade: "Autoridade",
  convidado: "Convidado",
} as const;
export type TipoParticipante = keyof typeof TIPOS_PARTICIPANTE;

export const TIPOS_EVENTO = {
  palestra: "Palestra",
  workshop: "Workshop",
  treinamento: "Treinamento",
  kickoff: "Kickoff",
  lancamento: "Lançamento",
  premiacao_incentivo: "Premiação e incentivo",
  demonstracao_produto: "Demonstração de produto",
  feedback: "Feedback",
} as const;
export type TipoEvento = keyof typeof TIPOS_EVENTO;

// Aceita "Palestrantes", "vip", "AUTORIDADES", "Convidado".
export function lerTipoParticipante(valor: string): TipoParticipante | null {
  const chave = semAcento(valor).toLowerCase().trim().replace(/s$/, "");
  return chave in TIPOS_PARTICIPANTE ? (chave as TipoParticipante) : null;
}

// id que vem da URL: sem isso um id torto vira erro 22P02 do Postgres em vez de 404.
export function ehUuid(valor: string): boolean {
  return z.uuid().safeParse(valor).success;
}

// "2026-02-31" casa com a regex mas não existe; o round-trip pelo Date pega isso.
export function dataIsoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

// "2027-01-15" -> "15/01/2027", sem passar por Date (que desloca o dia pelo fuso).
export function formatarData(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const participanteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").transform((v) => v.replace(/\s+/g, " ")),
  documento: z.string().transform((v, ctx) => {
    const r = validarDocumento(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.erro });
      return z.NEVER;
    }
    return r.documento;
  }),
  data_nascimento: textoOpcional.refine((v) => v === null || dataIsoValida(v), "Data de nascimento inválida"),
  email: textoOpcional.refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido"),
  telefone: textoOpcional,
  tipo: z.enum(Object.keys(TIPOS_PARTICIPANTE) as [TipoParticipante, ...TipoParticipante[]], { message: "Tipo inválido" }),
});
export type ParticipanteInput = z.output<typeof participanteSchema>;

export const eventoSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  tipo: z.enum(Object.keys(TIPOS_EVENTO) as [TipoEvento, ...TipoEvento[]], { message: "Tipo inválido" }),
  data: z.string().refine(dataIsoValida, "Data inválida"),
  empresa_id: z.uuid({ message: "Escolha a empresa" }),
});
export type EventoInput = z.output<typeof eventoSchema>;

export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").transform((v) => v.replace(/\s+/g, " ")),
});
