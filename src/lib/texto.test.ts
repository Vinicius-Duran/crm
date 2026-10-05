import { describe, expect, it } from "vitest";
import { gerarCodigo } from "./codigo";
import { escaparHtml, iniciais, limparTermo, normalizarBusca } from "./texto";

describe("normalizarBusca", () => {
  it("tira acento, caixa e espaço sobrando", () => {
    expect(normalizarBusca("  JOSÉ   Conceição ")).toBe("jose conceicao");
  });
});

describe("limparTermo", () => {
  it("remove o que quebraria o filtro .or() do PostgREST", () => {
    expect(limparTermo("ana,(silva)%*")).toBe("ana silva");
  });
});

describe("escaparHtml", () => {
  it("neutraliza tag no nome", () => {
    expect(escaparHtml('<b>Ana</b> & "Bia"')).toBe("&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Bia&quot;");
  });
});

describe("gerarCodigo", () => {
  it("gera 22 caracteres base64url, diferentes a cada chamada", () => {
    const a = gerarCodigo();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(gerarCodigo()).not.toBe(a);
  });
});

describe("iniciais", () => {
  it("usa o primeiro e o último nome", () => {
    expect(iniciais("José da Conceição")).toBe("JC");
    expect(iniciais("  maria   souza ")).toBe("MS");
  });

  it("nome único dá uma letra, vazio dá ?", () => {
    expect(iniciais("Ana")).toBe("A");
    expect(iniciais("   ")).toBe("?");
  });

  it("mantém o acento da inicial", () => {
    expect(iniciais("Érica Ávila")).toBe("ÉÁ");
  });
});
