import { beforeEach, describe, expect, it, vi } from "vitest";

// As actions de /admin usam dbServico (todas as contas, sem RLS) e aceitam POST direto, sem a tela.
// Quem não é admin precisa parar em exigirAdmin(), antes de qualquer acesso ao banco.
const m = vi.hoisted(() => ({
  admin: true,
  inserido: undefined as unknown,
  dbServico: vi.fn(),
  criarUsuario: vi.fn(),
  redefinirSenha: vi.fn(),
  alternarAtivoDe: vi.fn(),
}));

vi.mock("@/lib/sessao", () => ({
  exigirAdmin: async () => {
    if (!m.admin) throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    return { id: "admin", adminPlataforma: true };
  },
}));
vi.mock("@/lib/supabase", () => ({ dbServico: m.dbServico }));
vi.mock("@/lib/usuarios", () => ({ criarUsuario: m.criarUsuario, redefinirSenha: m.redefinirSenha, alternarAtivoDe: m.alternarAtivoDe }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));

const { alternarAtivoAdmin, redefinirSenhaAdmin, salvarConta, salvarUsuarioDaConta } = await import("./actions");

const CONTA = "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f";

function form(campos: [string, string][]): FormData {
  const f = new FormData();
  for (const [chave, valor] of campos) f.append(chave, valor);
  return f;
}

beforeEach(() => {
  m.admin = true;
  m.inserido = undefined;
  for (const fn of [m.dbServico, m.criarUsuario, m.redefinirSenha, m.alternarAtivoDe]) fn.mockReset();
  m.dbServico.mockReturnValue({
    from: () => ({
      insert: async (linha: unknown) => {
        m.inserido = linha;
        return { error: null };
      },
    }),
  });
});

describe("quem não é administrador da plataforma", () => {
  it("é barrado em todas as actions antes de tocar no banco", async () => {
    m.admin = false;
    const conta = form([["nome", "Barbearia do Zé"], ["slug", "barbearia-do-ze"]]);
    const usuario = form([["conta_id", CONTA], ["nome", "Ana"], ["email", "ana@exemplo.test"], ["papel", "dono"], ["senha", "12345678"]]);
    await expect(salvarConta({ ok: true, mensagem: "" }, conta)).rejects.toThrow("404");
    await expect(salvarUsuarioDaConta({ ok: true, mensagem: "" }, usuario)).rejects.toThrow("404");
    await expect(redefinirSenhaAdmin(CONTA)).rejects.toThrow("404");
    await expect(alternarAtivoAdmin(CONTA)).rejects.toThrow("404");
    expect(m.dbServico).not.toHaveBeenCalled();
    expect(m.criarUsuario).not.toHaveBeenCalled();
    expect(m.redefinirSenha).not.toHaveBeenCalled();
    expect(m.alternarAtivoDe).not.toHaveBeenCalled();
  });
});

describe("salvarConta", () => {
  it("grava todos os módulos marcados, não só o último", async () => {
    const f = form([["nome", "Barbearia do Zé"], ["slug", "barbearia-do-ze"], ["modulos", "eventos"], ["modulos", "barbearia"], ["fuso", "America/Manaus"]]);
    await expect(salvarConta({ ok: true, mensagem: "" }, f)).rejects.toThrow("NEXT_REDIRECT");
    expect(m.inserido).toEqual({ nome: "Barbearia do Zé", slug: "barbearia-do-ze", modulos: ["eventos", "barbearia"], fuso: "America/Manaus" });
  });

  it("devolve o erro do slug sem gravar", async () => {
    const r = await salvarConta({ ok: true, mensagem: "" }, form([["nome", "Zé"], ["slug", "Ze"]]));
    expect(r.ok).toBe(false);
    expect(r.erros?.slug).toBeDefined();
    expect(m.inserido).toBeUndefined();
  });
});
