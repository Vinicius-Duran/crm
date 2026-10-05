import { describe, expect, it } from "vitest";
import { autorizado } from "./acesso";

const basic = (credenciais: string) =>
  "Basic " + Buffer.from(credenciais, "utf8").toString("base64");

describe("autorizado", () => {
  it("aceita usuário e senha corretos", () => {
    expect(autorizado(basic("equipe:s3nha"), "equipe", "s3nha")).toBe(true);
  });

  it("aceita senha com dois-pontos e acento", () => {
    expect(autorizado(basic("equipe:a:ção"), "equipe", "a:ção")).toBe(true);
  });

  it("recusa senha errada, usuário errado, cabeçalho ausente ou malformado", () => {
    expect(autorizado(basic("equipe:errada"), "equipe", "s3nha")).toBe(false);
    expect(autorizado(basic("outro:s3nha"), "equipe", "s3nha")).toBe(false);
    expect(autorizado(null, "equipe", "s3nha")).toBe(false);
    expect(autorizado("Bearer xyz", "equipe", "s3nha")).toBe(false);
    expect(autorizado("Basic %%%", "equipe", "s3nha")).toBe(false);
  });
});
