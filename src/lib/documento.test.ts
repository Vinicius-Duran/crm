import { describe, expect, it } from "vitest";
import { cpfValido, formatarDocumento, normalizarDocumento, validarDocumento } from "./documento";

describe("normalizarDocumento", () => {
  it("tira pontuação e põe em caixa alta", () => {
    expect(normalizarDocumento("529.982.247-25")).toBe("52998224725");
    expect(normalizarDocumento(" fx-123 456 ")).toBe("FX123456");
  });
});

describe("cpfValido", () => {
  it("aceita CPF com verificadores certos", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
  });
  it("aceita CPF que começa com zero", () => {
    expect(cpfValido("01234567890")).toBe(true);
  });
  it("recusa verificador errado e sequência repetida", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
});

describe("validarDocumento", () => {
  it("11 dígitos inválidos = CPF inválido", () => {
    expect(validarDocumento("529.982.247-24")).toEqual({ ok: false, erro: "CPF inválido" });
  });
  it("passaporte passa como veio", () => {
    expect(validarDocumento("FX123456")).toEqual({ ok: true, documento: "FX123456" });
  });
  it("vazio é obrigatório", () => {
    expect(validarDocumento(" .- ")).toEqual({ ok: false, erro: "Documento obrigatório" });
  });
});

describe("formatarDocumento", () => {
  it("CPF ganha pontos e traço; o resto (passaporte) sai como está", () => {
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("AB123456")).toBe("AB123456");
    expect(formatarDocumento("123456789012")).toBe("123456789012");
  });
});
