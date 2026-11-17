import { beforeEach, describe, expect, it, vi } from "vitest";

// O dono não mexe em quem tem admin_plataforma (decisão do autor na #40): esconder o botão não
// basta, porque a Server Action aceita POST direto com qualquer id. Aqui a action é chamada sem a
// tela, e a recusa precisa vir dela.
const m = vi.hoisted(() => ({
  linhas: {} as Record<string, { nome: string; admin_plataforma: boolean }>,
  redefinirSenha: vi.fn(async () => "Temp234567"),
  alternarAtivoDe: vi.fn(async () => ({ desativado: true })),
}));

vi.mock("@/lib/sessao", () => ({
  exigirDono: async () => ({ id: "dono", papel: "dono", adminPlataforma: false, conta: { id: "conta" } }),
}));
vi.mock("@/lib/supabase", () => ({
  dbUsuario: async () => ({
    from: () => ({
      select: () => ({ eq: (_coluna: string, id: string) => ({ maybeSingle: async () => ({ data: m.linhas[id] ?? null }) }) }),
    }),
  }),
}));
vi.mock("@/lib/usuarios", () => ({ criarUsuario: vi.fn(), redefinirSenha: m.redefinirSenha, alternarAtivoDe: m.alternarAtivoDe }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { alternarAtivo, redefinirSenhaDe } = await import("./actions");

beforeEach(() => {
  m.linhas = {
    admin: { nome: "Admin da Plataforma", admin_plataforma: true },
    comum: { nome: "Usuário Comum", admin_plataforma: false },
  };
  m.redefinirSenha.mockClear();
  m.alternarAtivoDe.mockClear();
});

describe("dono diante de um administrador da plataforma", () => {
  it("não redefine a senha", async () => {
    await expect(redefinirSenhaDe("admin")).resolves.toEqual({ ok: false, mensagem: "O administrador da plataforma não pode ser alterado aqui" });
    expect(m.redefinirSenha).not.toHaveBeenCalled();
  });

  it("não desativa", async () => {
    await expect(alternarAtivo("admin")).resolves.toEqual({ ok: false, mensagem: "O administrador da plataforma não pode ser alterado aqui" });
    expect(m.alternarAtivoDe).not.toHaveBeenCalled();
  });

  it("continua redefinindo e desativando um usuário comum", async () => {
    expect((await redefinirSenhaDe("comum")).ok).toBe(true);
    expect(m.redefinirSenha).toHaveBeenCalledWith("comum");
    expect((await alternarAtivo("comum")).ok).toBe(true);
    expect(m.alternarAtivoDe).toHaveBeenCalledWith("comum");
  });
});
