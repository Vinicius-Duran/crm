import { describe, expect, it } from "vitest";
import { destinoSeguro, gruposPara, inicioDe, itemAtivo, trilha } from "./navegacao";

describe("itemAtivo", () => {
  const grupos = gruposPara({ papel: "dono", adminPlataforma: false, modulos: ["eventos"] });

  it("acende o item da rota e das sub-rotas", () => {
    expect(itemAtivo("/eventos", grupos)).toBe("/eventos");
    expect(itemAtivo("/eventos/123/participantes/novo", grupos)).toBe("/eventos");
    expect(itemAtivo("/empresas/123", grupos)).toBe("/empresas");
  });

  it("rota que saiu do menu não acende nada", () => {
    expect(itemAtivo("/participantes", grupos)).toBeUndefined();
  });

  it("não confunde prefixo de texto com rota", () => {
    expect(itemAtivo("/eventosx", grupos)).toBeUndefined();
    expect(itemAtivo("/", grupos)).toBeUndefined();
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

describe("destinoSeguro", () => {
  it("aceita caminho interno e recusa externo, vazio e protocol-relative", () => {
    expect(destinoSeguro("/eventos/abc")).toBe("/eventos/abc");
    expect(destinoSeguro("https://outro-site")).toBe("/");
    expect(destinoSeguro("//outro-site")).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro("/entrar")).toBe("/");
  });
});

describe("gruposPara e inicioDe", () => {
  const dono = { papel: "dono", adminPlataforma: false, modulos: ["eventos"] } as const;
  const barbeiro = { ...dono, papel: "barbeiro" } as const;
  const admin = { papel: "dono", adminPlataforma: true, modulos: [] } as const;

  it("dono com eventos: Gestão, Operação, Conta; barbeiro sem barbearia: nada; admin sem módulo: Conta e Plataforma", () => {
    expect(gruposPara(dono).map((g) => g.titulo)).toEqual(["Gestão", "Operação", "Conta"]);
    expect(gruposPara(barbeiro)).toEqual([]);
    expect(gruposPara(admin).map((g) => g.titulo)).toEqual(["Conta", "Plataforma"]);
  });

  it("início: /eventos, /minha-conta, /admin/contas", () => {
    expect(inicioDe(dono)).toBe("/eventos");
    expect(inicioDe(barbeiro)).toBe("/minha-conta");
    expect(inicioDe(admin)).toBe("/admin/contas");
  });

  it("itemAtivo usa os grupos recebidos", () => {
    expect(itemAtivo("/eventos/abc/participantes", gruposPara(dono))).toBe("/eventos");
    expect(itemAtivo("/eventos/abc", gruposPara(barbeiro))).toBeUndefined();
  });
});
