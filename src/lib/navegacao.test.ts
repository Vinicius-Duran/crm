import { describe, expect, it } from "vitest";
import { itemAtivo, trilha } from "./navegacao";

describe("itemAtivo", () => {
  it("acende o item da rota e das sub-rotas", () => {
    expect(itemAtivo("/eventos")).toBe("/eventos");
    expect(itemAtivo("/eventos/123/participantes/novo")).toBe("/eventos");
    expect(itemAtivo("/empresas/123")).toBe("/empresas");
  });

  it("rota que saiu do menu não acende nada", () => {
    expect(itemAtivo("/participantes")).toBeUndefined();
  });

  it("não confunde prefixo de texto com rota", () => {
    expect(itemAtivo("/eventosx")).toBeUndefined();
    expect(itemAtivo("/")).toBeUndefined();
  });
});

describe("trilha", () => {
  it("nomeia os segmentos conhecidos e chama o id de Detalhe", () => {
    expect(trilha("/eventos/4f1c/participantes/novo")).toEqual([
      { href: "/eventos", texto: "Eventos" },
      { href: "/eventos/4f1c", texto: "Detalhe" },
      { href: "/eventos/4f1c/participantes", texto: "Participantes" },
      { href: "/eventos/4f1c/participantes/novo", texto: "Novo" },
    ]);
  });

  it("raiz não tem passos", () => {
    expect(trilha("/")).toEqual([]);
  });
});
