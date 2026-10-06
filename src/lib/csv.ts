import { formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "./dominio";

export type EventoCsv = { empresa: string; nome: string; tipo: TipoEvento; data: string };
export type ParticipanteCsv = {
  nome: string;
  documento: string;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  tipo: TipoParticipante;
  checkin_em: string | null;
};

const CABECALHO = [
  "empresa", "evento", "tipo_evento", "data_evento", "nome", "documento", "data_nascimento",
  "email", "telefone", "empresa_participante", "tipo", "compareceu", "chegada",
];

// Excel executa como fórmula o que começa com = + - @ tab ou CR; o apóstrofo desliga isso.
// Separador, aspas ou quebra de linha: entre aspas, com aspas dobradas.
export function celulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

// "2027-01-15T13:05:00Z" -> "15/01/2027 10:05", no fuso de Brasília.
function chegada(iso: string): string {
  return new Date(iso)
    .toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    .replace(",", "");
}

// Separador ; e UTF-8 com BOM: é o que o Excel brasileiro abre sem juntar colunas nem estragar acento.
export function csvDoEvento(evento: EventoCsv, participantes: ParticipanteCsv[]): string {
  const linhas = participantes.map((p) => [
    evento.empresa,
    evento.nome,
    TIPOS_EVENTO[evento.tipo],
    formatarData(evento.data),
    p.nome,
    p.documento,
    formatarData(p.data_nascimento),
    p.email ?? "",
    p.telefone ?? "",
    p.empresa ?? "",
    TIPOS_PARTICIPANTE[p.tipo],
    p.checkin_em ? "Sim" : "Não",
    p.checkin_em ? chegada(p.checkin_em) : "",
  ]);
  return "﻿" + [CABECALHO, ...linhas].map((l) => l.map(celulaCsv).join(";") + "\r\n").join("");
}
