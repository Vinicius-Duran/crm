import { describe, expect, it } from "vitest";
import { empresaSchema } from "./dominio";
import { errosDoZod, valoresDo } from "./acao";

describe("valoresDo", () => {
  it("pega só os campos de texto do form", () => {
    const form = new FormData();
    form.set("nome", "Acme");
    form.set("arquivo", new Blob(["x"]));
    expect(valoresDo(form)).toEqual({ nome: "Acme" });
  });
});

describe("errosDoZod", () => {
  it("agrupa a mensagem por campo e devolve o que foi digitado", () => {
    const r = empresaSchema.safeParse({ nome: "  " });
    expect(r.success).toBe(false);
    expect(errosDoZod(r.error!, { nome: "  " })).toEqual({
      ok: false,
      mensagem: "Corrija os campos destacados",
      erros: { nome: ["Nome obrigatório"] },
      valores: { nome: "  " },
    });
  });
});
