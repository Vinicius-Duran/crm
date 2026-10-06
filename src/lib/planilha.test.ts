import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { lerPlanilha, modeloPlanilha, validarLinhas } from "./planilha";

function xlsx(linhas: unknown[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), "p");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

describe("lerPlanilha", () => {
  it("lê o modelo que o sistema oferece para baixar", () => {
    const linhas = lerPlanilha(modeloPlanilha());
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ linha: 2, nome: "Maria da Silva", tipo: "Convidado" });
  });

  it("aceita cabeçalho com acento, caixa e apelido", () => {
    const [l] = lerPlanilha(
      xlsx([
        ["Nome", "CPF", "Data de Nascimento", "E-mail", "Celular", "Empresa", "Cargo"],
        ["Ana", "52998224725", "17/05/1990", "a@b.com", "11", "Acme", "VIP"],
      ]),
    );
    expect(l).toMatchObject({ nome: "Ana", documento: "52998224725", data_nascimento: "1990-05-17", email: "a@b.com", telefone: "11", empresa: "Acme", tipo: "VIP" });
  });

  it("devolve o zero à esquerda que o Excel come do CPF numérico", () => {
    const [l] = lerPlanilha(xlsx([["nome", "documento", "tipo"], ["Ana", 1234567890, "vip"]]));
    expect(l.documento).toBe("01234567890");
  });

  it("converte data serial do Excel sem desvio de fuso", () => {
    // 25569 = 1970-01-01; 32994 - 25569 = 7425 dias = 1990-05-01
    const [l] = lerPlanilha(xlsx([["nome", "data_nascimento"], ["Ana", 32994]]));
    expect(l.data_nascimento).toBe("1990-05-01");
  });

  it("lê CSV UTF-8 separado por ponto e vírgula", () => {
    const [l] = lerPlanilha(new TextEncoder().encode("nome;documento;tipo\nJosé Conceição;529.982.247-25;Palestrante\n"));
    expect(l).toMatchObject({ nome: "José Conceição", documento: "529.982.247-25", tipo: "Palestrante" });
  });

  it("lê CSV UTF-8 com BOM sem sujar o primeiro cabeçalho", () => {
    const [l] = lerPlanilha(new TextEncoder().encode("﻿nome,documento\nAna,1\n"));
    expect(l).toMatchObject({ nome: "Ana", documento: "1" });
  });

  it("CSV: data dd/mm brasileira e CPF com zero à esquerda chegam intactos", () => {
    const [l] = lerPlanilha(new TextEncoder().encode("nome,documento,data_nascimento\nAna,01234567890,05/06/1990\n"));
    expect(l).toMatchObject({ documento: "01234567890", data_nascimento: "1990-06-05" });
  });

  it("lê CSV salvo pelo Excel brasileiro (Windows-1252)", () => {
    const [l] = lerPlanilha(new Uint8Array(Buffer.from("nome;documento;tipo\r\nJosé Conceição;529.982.247-25;VIP\r\n", "latin1")));
    expect(l.nome).toBe("José Conceição");
  });

  it("lê o \"Texto Unicode\" do Excel (UTF-16 com BOM, separado por tab)", () => {
    const texto = "nome\tdocumento\ttipo\r\nJosé Conceição\t529.982.247-25\tVIP\r\n";
    const le = new Uint8Array([0xff, 0xfe, ...Buffer.from(texto, "utf16le")]);
    const be = new Uint8Array([0xfe, 0xff, ...Buffer.from(texto, "utf16le").swap16()]);
    for (const bytes of [le, be]) {
      expect(lerPlanilha(bytes)).toEqual([
        { linha: 2, nome: "José Conceição", documento: "529.982.247-25", data_nascimento: "", email: "", telefone: "", empresa: "", tipo: "VIP" },
      ]);
    }
  });

  it("ignora linha totalmente vazia e numera pela linha da planilha", () => {
    const linhas = lerPlanilha(xlsx([["nome", "documento"], ["Ana", "1"], ["", ""], ["Bia", "2"]]));
    expect(linhas.map((l) => l.linha)).toEqual([2, 4]);
  });
});

describe("validarLinhas", () => {
  const base = { nome: "Ana", documento: "529.982.247-25", data_nascimento: "", email: "", telefone: "", empresa: " Acme  Ltda ", tipo: "VIPs" };

  it("valida, normaliza tipo e empresa", () => {
    const [r] = validarLinhas([{ linha: 2, ...base }]);
    expect(r).toEqual({
      linha: 2,
      ok: true,
      dados: { nome: "Ana", documento: "52998224725", data_nascimento: null, email: null, telefone: null, tipo: "vip", empresa: "Acme Ltda" },
    });
  });

  it("documento repetido na mesma planilha aponta a linha anterior", () => {
    const r = validarLinhas([{ linha: 2, ...base }, { linha: 3, ...base, documento: "52998224725" }]);
    expect(r[1]).toEqual({ linha: 3, ok: false, erros: ["Documento repetido na linha 2"] });
  });

  it("linha ruim não derruba as outras", () => {
    const r = validarLinhas([{ linha: 2, ...base, tipo: "Imprensa" }, { linha: 3, ...base }]);
    expect(r.map((x) => x.ok)).toEqual([false, true]);
  });
});
