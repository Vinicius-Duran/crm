import * as XLSX from "xlsx";
import { participanteSchema, lerTipoParticipante, type ParticipanteInput } from "./dominio";
import { semAcento } from "./texto";

export const COLUNAS = ["nome", "documento", "data_nascimento", "email", "telefone", "empresa", "tipo"] as const;
type Coluna = (typeof COLUNAS)[number];

const APELIDOS: Record<string, Coluna> = {
  nome: "nome",
  documento: "documento",
  cpf: "documento",
  data_nascimento: "data_nascimento",
  data_de_nascimento: "data_nascimento",
  nascimento: "data_nascimento",
  email: "email",
  e_mail: "email",
  telefone: "telefone",
  celular: "telefone",
  empresa: "empresa",
  tipo: "tipo",
  cargo: "tipo",
  tipo_cargo: "tipo",
};

export type LinhaBruta = { linha: number } & Record<Coluna, string>;
export type DadosImportacao = ParticipanteInput;
export type LinhaValidada =
  | { linha: number; ok: true; dados: DadosImportacao }
  | { linha: number; ok: false; erros: string[] };

function chaveCabecalho(valor: unknown): Coluna | undefined {
  const chave = semAcento(String(valor)).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return APELIDOS[chave];
}

function celulaTexto(coluna: Coluna, valor: unknown): string {
  if (typeof valor === "number") {
    // Excel guarda CPF digitado como número e come o zero à esquerda.
    if (coluna === "documento") return String(Math.round(valor)).padStart(11, "0");
    // Data do Excel chega como número serial de dias.
    if (coluna === "data_nascimento") {
      const d = XLSX.SSF.parse_date_code(valor);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  const texto = String(valor ?? "").trim();
  const br = coluna === "data_nascimento" && texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return texto;
}

// .xlsx é zip ("PK"), .xls é CFB (D0 CF 11 E0). O resto é CSV/texto.
function ehBinario(b: Uint8Array): boolean {
  return (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
}

// SheetJS lê CSV sem BOM como Latin-1 e estraga UTF-8. Tenta UTF-8 estrito; se não for, é o
// Windows-1252 que o Excel brasileiro grava.
function decodificarTexto(b: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return new TextDecoder("windows-1252").decode(b);
  }
}

// Primeira aba; linha 1 da planilha é o cabeçalho, então os dados começam na linha 2.
export function lerPlanilha(arquivo: Uint8Array): LinhaBruta[] {
  // raw no CSV: sem isso o SheetJS lê "05/06/1990" como data americana (6 de maio) e come zero de CPF.
  const wb = ehBinario(arquivo)
    ? XLSX.read(arquivo, { type: "array" })
    : XLSX.read(decodificarTexto(arquivo), { type: "string", raw: true });
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) return [];
  const [cabecalho = [], ...linhas] = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  const mapa = cabecalho.map(chaveCabecalho);
  return linhas
    .map((celulas, i) => {
      const linha = { linha: i + 2 } as LinhaBruta;
      for (const c of COLUNAS) linha[c] = "";
      mapa.forEach((coluna, j) => {
        if (coluna) linha[coluna] = celulaTexto(coluna, celulas[j]);
      });
      return linha;
    })
    .filter((l) => COLUNAS.some((c) => l[c] !== ""));
}

export function validarLinhas(linhas: LinhaBruta[]): LinhaValidada[] {
  const vistos = new Map<string, number>();
  return linhas.map((l) => {
    const r = participanteSchema.safeParse({ ...l, tipo: lerTipoParticipante(l.tipo) ?? l.tipo });
    if (!r.success) return { linha: l.linha, ok: false, erros: r.error.issues.map((i) => i.message) };
    const anterior = vistos.get(r.data.documento);
    if (anterior) return { linha: l.linha, ok: false, erros: [`Documento repetido na linha ${anterior}`] };
    vistos.set(r.data.documento, l.linha);
    return { linha: l.linha, ok: true, dados: r.data };
  });
}

export function modeloPlanilha(): Uint8Array {
  const aba = XLSX.utils.aoa_to_sheet([
    [...COLUNAS],
    ["Maria da Silva", "529.982.247-25", "1990-05-17", "maria@exemplo.com", "(11) 91234-5678", "Acme", "Convidado"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aba, "participantes");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
