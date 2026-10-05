import { describe, expect, it } from "vitest";
import { dataIsoValida, ehUuid, eventoSchema, formatarData, lerTipoParticipante, participanteSchema } from "./dominio";

describe("lerTipoParticipante", () => {
  it("aceita plural, caixa e acento", () => {
    expect(lerTipoParticipante("Palestrantes")).toBe("palestrante");
    expect(lerTipoParticipante("VIP")).toBe("vip");
    expect(lerTipoParticipante(" autoridades ")).toBe("autoridade");
    expect(lerTipoParticipante("Imprensa")).toBeNull();
  });
});

describe("dataIsoValida", () => {
  it("recusa dia que não existe", () => {
    expect(dataIsoValida("2026-02-28")).toBe(true);
    expect(dataIsoValida("2026-02-31")).toBe(false);
    expect(dataIsoValida("17/05/1990")).toBe(false);
  });
});

describe("participanteSchema", () => {
  it("normaliza e transforma campo vazio em null", () => {
    const r = participanteSchema.parse({
      nome: "  Maria   da Silva ",
      documento: "529.982.247-25",
      data_nascimento: "",
      email: "",
      telefone: " ",
      tipo: "vip",
    });
    expect(r).toEqual({
      nome: "Maria da Silva",
      documento: "52998224725",
      data_nascimento: null,
      email: null,
      telefone: null,
      tipo: "vip",
    });
  });
  it("junta as mensagens de erro", () => {
    const r = participanteSchema.safeParse({
      nome: "",
      documento: "111.111.111-11",
      data_nascimento: "1990-13-01",
      email: "nao-e-email",
      telefone: "",
      tipo: "imprensa",
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).sort()).toEqual(
      ["CPF inválido", "Data de nascimento inválida", "E-mail inválido", "Nome obrigatório", "Tipo inválido"].sort(),
    );
  });
});

describe("formatarData", () => {
  it("formata sem deslocar o dia", () => {
    expect(formatarData("2027-01-15")).toBe("15/01/2027");
    expect(formatarData("2026-10-05T23:30:00-03:00")).toBe("05/10/2026");
    expect(formatarData(null)).toBe("");
  });
});

describe("ehUuid", () => {
  it("aceita uuid e recusa o resto", () => {
    expect(ehUuid("3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f")).toBe(true);
    expect(ehUuid("nao-uuid")).toBe(false);
  });
});

describe("eventoSchema", () => {
  it("exige data real", () => {
    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "2027-01-15" }).success).toBe(true);
    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "" }).success).toBe(false);
  });
});
