import { describe, expect, it } from "vitest";
import { paginar } from "./paginacao";

describe("paginar", () => {
  it("primeira página de 10.000 em páginas de 20", () => {
    expect(paginar("1", 10000, 20)).toEqual({ pagina: 1, paginas: 500, de: 0, ate: 19 });
  });

  it("última página incompleta", () => {
    expect(paginar("3", 45, 20)).toEqual({ pagina: 3, paginas: 3, de: 40, ate: 59 });
  });

  it("página fora do intervalo cai na última; lixo e ausência caem na primeira", () => {
    expect(paginar("999", 45, 20).pagina).toBe(3);
    expect(paginar("abc", 45, 20).pagina).toBe(1);
    expect(paginar("-2", 45, 20).pagina).toBe(1);
    expect(paginar("2.5", 45, 20).pagina).toBe(1);
    expect(paginar(undefined, 45, 20).pagina).toBe(1);
  });

  it("evento vazio tem uma página", () => {
    expect(paginar("1", 0, 20)).toEqual({ pagina: 1, paginas: 1, de: 0, ate: 19 });
  });
});
