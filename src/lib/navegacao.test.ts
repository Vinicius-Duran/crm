import { describe, expect, it } from "vitest";
import { itemAtivo, trilha } from "./navegacao";

describe("itemAtivo", () => {
  it("acende o item da rota e das sub-rotas", () => {
    expect(itemAtivo("/eventos")).toBe("/eventos");
    expect(itemAtivo("/eventos/123/inscrever")).toBe("/eventos");
  });

  it("prefere o prefixo mais longo", () => {
    expect(itemAtivo("/participantes/importar")).toBe("/participantes/importar");
    expect(itemAtivo("/participantes/novo")).toBe("/participantes");
  });

  it("não confunde prefixo de texto com rota", () => {
    expect(itemAtivo("/eventosx")).toBeUndefined();
    expect(itemAtivo("/")).toBeUndefined();
  });
});

describe("trilha", () => {
  it("nomeia os segmentos conhecidos e chama o id de Detalhe", () => {
    expect(trilha("/eventos/4f1c/inscrever")).toEqual([
      { href: "/eventos", texto: "Eventos" },
      { href: "/eventos/4f1c", texto: "Detalhe" },
      { href: "/eventos/4f1c/inscrever", texto: "Inscrever" },
    ]);
  });

  it("raiz não tem passos", () => {
    expect(trilha("/")).toEqual([]);
  });
});
