import { describe, expect, it } from "vitest";
import { mensagemErro } from "./erros";

describe("mensagemErro", () => {
  it("traduz unicidade com a frase de quem chamou", () => {
    expect(mensagemErro({ code: "23505", message: "duplicate key" }, "Empresa já cadastrada")).toBe("Empresa já cadastrada");
  });
  it("traduz restrict (23001) e FK (23503) como registro em uso", () => {
    expect(mensagemErro({ code: "23001", message: "x" })).toBe("Não dá para apagar: há cadastros ligados a este registro");
    expect(mensagemErro({ code: "23503", message: "x" })).toBe("Não dá para apagar: há cadastros ligados a este registro");
  });
  it("erro desconhecido mostra a mensagem original", () => {
    expect(mensagemErro({ message: "fetch failed" })).toBe("Erro ao salvar: fetch failed");
  });
});
