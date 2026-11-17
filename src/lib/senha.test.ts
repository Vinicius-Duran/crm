import { describe, expect, it } from "vitest";
import { gerarSenhaTemporaria } from "./senha";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

describe("gerarSenhaTemporaria", () => {
  it("gera 200 senhas de 10 caracteres do alfabeto sem 0/O/1/l/I, sem repetição", () => {
    const senhas = Array.from({ length: 200 }, () => gerarSenhaTemporaria());
    for (const senha of senhas) {
      expect(senha).toHaveLength(10);
      expect([...senha].every((c) => ALFABETO.includes(c))).toBe(true);
    }
    expect(new Set(senhas).size).toBe(200);
  });
});
