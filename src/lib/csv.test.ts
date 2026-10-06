import { describe, expect, it } from "vitest";
import { celulaCsv, csvDoEvento } from "./csv";

const evento = { empresa: "Acme Ltda", nome: "Kickoff 2027", tipo: "kickoff" as const, data: "2027-01-15" };
const maria = {
  nome: "Maria da Silva",
  documento: "52998224725",
  data_nascimento: "1990-05-17",
  email: "maria@exemplo.com",
  telefone: "(11) 91234-5678",
  empresa: "Beta; Filial Sul",
  tipo: "vip" as const,
  // 13:05 em UTC = 10:05 em Brasília
  checkin_em: "2027-01-15T13:05:00+00:00",
};
const joao = { ...maria, nome: "João", documento: "11144477735", data_nascimento: null, email: null, telefone: null, empresa: null, checkin_em: null };

describe("celulaCsv", () => {
  it("põe entre aspas o que tem separador, aspas ou quebra de linha", () => {
    expect(celulaCsv("simples")).toBe("simples");
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv("linha\nnova")).toBe('"linha\nnova"');
  });

  it("neutraliza o que o Excel executaria como fórmula", () => {
    expect(celulaCsv("=1+1")).toBe("'=1+1");
    expect(celulaCsv("+55 11")).toBe("'+55 11");
    expect(celulaCsv("-2")).toBe("'-2");
    expect(celulaCsv("@SOMA(A1)")).toBe("'@SOMA(A1)");
    expect(celulaCsv("\tx")).toBe("'\tx");
  });
});

describe("csvDoEvento", () => {
  const csv = csvDoEvento(evento, [maria, joao]);
  const linhas = csv.slice(1).split("\r\n");

  it("começa com BOM e usa ; e CRLF", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas[0]).toBe(
      "empresa;evento;tipo_evento;data_evento;nome;documento;data_nascimento;email;telefone;empresa_participante;tipo;compareceu;chegada",
    );
  });

  it("uma linha por participante, com presença e chegada no horário de Brasília", () => {
    expect(linhas[1]).toBe(
      'Acme Ltda;Kickoff 2027;Kickoff;15/01/2027;Maria da Silva;52998224725;17/05/1990;maria@exemplo.com;(11) 91234-5678;"Beta; Filial Sul";VIP;Sim;15/01/2027 10:05',
    );
    expect(linhas[2]).toBe("Acme Ltda;Kickoff 2027;Kickoff;15/01/2027;João;11144477735;;;;;VIP;Não;");
    expect(linhas).toHaveLength(4); // cabeçalho, 2 participantes e a linha vazia depois do último CRLF
  });

  it("evento sem participantes sai só com o cabeçalho", () => {
    expect(csvDoEvento(evento, []).slice(1).split("\r\n")).toHaveLength(2);
  });
});
