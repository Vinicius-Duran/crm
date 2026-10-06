import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import { gerarCredencialPdf, textosCredencial } from "./pdf";
import { juntarZips, montarZip, nomeArquivo } from "./zip";

const dados = {
  nome: "José Conceição",
  tipo: "VIP",
  empresa: "Fornecedora Beta",
  empresaCliente: "Acme Ltda",
  evento: "Kickoff 2027",
  tipoEvento: "Premiação e incentivo",
  data: "15/01/2027",
  codigo: "AbCdEfGhIjKlMnOpQrStUv",
};

describe("textosCredencial", () => {
  it("monta cabeçalho, código impresso e rodapé com as duas marcas", () => {
    expect(textosCredencial(dados)).toEqual({
      empresaCliente: "ACME LTDA",
      evento: "Kickoff 2027",
      subtitulo: "Premiação e incentivo · 15/01/2027",
      codigo: "AbCdEfGhIjKlMnOpQrStUv",
      nome: "José Conceição",
      tipo: "VIP",
      empresa: "Fornecedora Beta",
      aviso: "Credencial pessoal e intransferível.",
      instrucao: "Apresente este QR code na entrada do evento.",
      rodape: "© 2027 Acme Ltda · Organização VM Events. Todos os direitos reservados.",
    });
  });

  it("o ano do rodapé é o do evento, não o de hoje", () => {
    expect(textosCredencial({ ...dados, data: "03/12/2026" }).rodape).toMatch(/^© 2026 /);
  });
});

describe("gerarCredencialPdf", () => {
  it("gera um PDF de uma página A4", async () => {
    const doc = await PDFDocument.load(await gerarCredencialPdf(dados));
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("não quebra com letra fora do WinAnsi, nome e empresa cliente enormes e sem empresa", async () => {
    const bytes = await gerarCredencialPdf({ ...dados, nome: "Łukasz Żółć 李 " + "Muito ".repeat(30), empresa: null, empresaCliente: "Grupo " + "Enorme ".repeat(40) });
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

describe("juntarZips", () => {
  it("junta os lotes num ZIP só sem um homônimo de outro lote sobrescrever o primeiro", () => {
    const pdf = (n: number) => new Uint8Array([n]);
    const lote1 = montarZip([{ nome: "João Silva", conteudo: pdf(1) }, { nome: "João Silva", conteudo: pdf(2) }]);
    const lote2 = montarZip([{ nome: "João Silva", conteudo: pdf(3) }, { nome: "Maria", conteudo: pdf(4) }]);
    const zip = unzipSync(juntarZips([lote1, lote2]));
    expect(Object.keys(zip).sort()).toEqual(["joao-silva-2.pdf", "joao-silva-3.pdf", "joao-silva.pdf", "maria.pdf"]);
    expect([...zip["joao-silva.pdf"], ...zip["joao-silva-2.pdf"], ...zip["joao-silva-3.pdf"], ...zip["maria.pdf"]]).toEqual([1, 2, 3, 4]);
  });
});
