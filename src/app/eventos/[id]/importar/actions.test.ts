import { describe, expect, it, vi } from "vitest";

// O banco cai no meio da prévia: a Server Action precisa devolver { ok: false }, nunca rejeitar.
// Rejeição sobe para o error boundary e a página inteira vira "This page couldn't load".
vi.mock("@/lib/supabase", () => ({
  db: () => {
    throw new Error("fetch failed");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { importar, previsualizar } = await import("./actions");

const EVENTO = "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f";

function formCom(csv: string): FormData {
  const form = new FormData();
  form.set("arquivo", new File([csv], "p.csv", { type: "text/csv" }));
  return form;
}

const CSV = "nome;documento;tipo\nAna;529.982.247-25;VIP\n";

describe("importação com o banco fora do ar", () => {
  it("prévia devolve mensagem em vez de rejeitar", async () => {
    await expect(previsualizar(EVENTO, formCom(CSV))).resolves.toEqual({
      ok: false,
      mensagem: "Não consegui consultar o evento. Tente de novo.",
    });
  });

  it("gravação devolve mensagem em vez de rejeitar", async () => {
    await expect(importar(EVENTO, formCom(CSV))).resolves.toEqual({
      ok: false,
      mensagem: "Não consegui consultar o evento. Tente de novo.",
    });
  });
});

describe("entrada inválida", () => {
  it("evento que não é uuid", async () => {
    await expect(previsualizar("nao-uuid", formCom(CSV))).resolves.toEqual({ ok: false, mensagem: "Evento inválido" });
  });

  it("sem arquivo", async () => {
    await expect(previsualizar(EVENTO, new FormData())).resolves.toEqual({ ok: false, mensagem: "Escolha um arquivo CSV ou Excel" });
  });
});
