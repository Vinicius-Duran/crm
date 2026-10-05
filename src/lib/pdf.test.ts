import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import { gerarCredencialPdf } from "./pdf";
import { montarZip, nomeArquivo } from "./zip";

const dados = { nome: "José Conceição", tipo: "VIP", empresa: "Acme", evento: "Kickoff 2027", data: "15/01/2027", codigo: "AbCdEfGhIjKlMnOpQrStUv" };

describe("gerarCredencialPdf", () => {
  it("gera um PDF de uma página A4", async () => {
    const doc = await PDFDocument.load(await gerarCredencialPdf(dados));
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("não quebra com letra fora do WinAnsi, nome enorme e sem empresa", async () => {
    const bytes = await gerarCredencialPdf({ ...dados, nome: "Łukasz Żółć 李 " + "Muito ".repeat(30), empresa: null });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("montarZip", () => {
  it("nomeia pelo participante e não sobrescreve homônimos", () => {
    const pdf = new Uint8Array([1, 2, 3]);
    const zip = unzipSync(montarZip([{ nome: "João Silva", conteudo: pdf }, { nome: "João Silva", conteudo: pdf }, { nome: "../../etc", conteudo: pdf }]));
    expect(Object.keys(zip).sort()).toEqual(["etc.pdf", "joao-silva-2.pdf", "joao-silva.pdf"]);
  });

  it("nome só com símbolo vira participante", () => {
    expect(nomeArquivo("李")).toBe("participante");
  });
});
