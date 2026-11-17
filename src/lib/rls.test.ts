import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gerarCodigo } from "./codigo";

// Integração: roda contra o Supabase real (mesmas variáveis do e2e). Sem elas, pula com aviso.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function slugDe(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function senhaAleatoria(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

describe.skipIf(!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY)(
  "RLS: empresas, eventos e participantes isolados por conta",
  () => {
    const sufixo = randomBytes(4).toString("hex");
    const servico = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

    let contaAId: string;
    let contaBId: string;
    let usuarioAId: string;
    let usuarioBId: string;
    let a: SupabaseClient;
    let b: SupabaseClient;

    async function criarContaComUsuarioLogado(nome: string): Promise<{ contaId: string; usuarioId: string; cliente: SupabaseClient }> {
      const { data: conta, error: erroConta } = await servico
        .from("contas")
        .insert({ nome, slug: `${slugDe(nome)}-${sufixo}`.slice(0, 40), modulos: ["eventos"] })
        .select("id")
        .single();
      if (erroConta) throw erroConta;
      const email = `e2e-rls-${sufixo}-${slugDe(nome)}@exemplo.test`;
      const senha = senhaAleatoria();
      const { data: usuario, error: erroUsuario } = await servico.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (erroUsuario) throw erroUsuario;
      const { error: erroInsereUsuario } = await servico.from("usuarios").insert({ id: usuario.user.id, conta_id: conta!.id, nome, papel: "dono" });
      if (erroInsereUsuario) throw erroInsereUsuario;
      const cliente = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password: senha });
      if (erroLogin) throw erroLogin;
      return { contaId: conta!.id as string, usuarioId: usuario.user.id, cliente };
    }

    beforeAll(async () => {
      const contaA = await criarContaComUsuarioLogado(`RLS A ${sufixo}`);
      const contaB = await criarContaComUsuarioLogado(`RLS B ${sufixo}`);
      contaAId = contaA.contaId;
      contaBId = contaB.contaId;
      usuarioAId = contaA.usuarioId;
      usuarioBId = contaB.usuarioId;
      a = contaA.cliente;
      b = contaB.cliente;
    });

    afterAll(async () => {
      await servico.auth.admin.deleteUser(usuarioAId);
      await servico.auth.admin.deleteUser(usuarioBId);
      // Cascade apaga usuarios, empresas, eventos e participantes das duas contas.
      await servico.from("contas").delete().in("id", [contaAId, contaBId]);
    });

    it("empresa criada por A não aparece para B", async () => {
      const nome = `Empresa RLS ${sufixo}`;
      const { error: erroInsert } = await a.from("empresas").insert({ nome });
      expect(erroInsert).toBeNull();
      const { data: paraB } = await b.from("empresas").select("id").eq("nome", nome);
      expect(paraB).toEqual([]);
      const { data: paraA } = await a.from("empresas").select("id").eq("nome", nome);
      expect(paraA).toHaveLength(1);
    });

    it("B não consegue inserir, alterar nem apagar na conta de A", async () => {
      const { data: empresaDeA } = await a.from("empresas").insert({ nome: `Empresa de A ${sufixo}` }).select("id").single();
      const { error: erroInsertB } = await b.from("empresas").insert({ nome: `Invasão ${sufixo}`, conta_id: contaAId });
      expect(erroInsertB?.code).toBe("42501");
      const { count: contagemUpdate } = await b.from("empresas").update({ nome: "Alterada por B" }, { count: "exact" }).eq("id", empresaDeA!.id);
      expect(contagemUpdate).toBe(0);
      const { count: contagemDelete } = await b.from("empresas").delete({ count: "exact" }).eq("id", empresaDeA!.id);
      expect(contagemDelete).toBe(0);
    });

    it("participante de outra conta não aparece pelo código", async () => {
      const { data: empresa } = await a.from("empresas").insert({ nome: `Empresa Evento RLS ${sufixo}` }).select("id").single();
      const { data: evento } = await a
        .from("eventos")
        .insert({ nome: `Evento RLS ${sufixo}`, tipo: "kickoff", data: "2026-11-17", empresa_id: empresa!.id })
        .select("id")
        .single();
      const codigo = gerarCodigo();
      const { error: erroParticipante } = await a.from("participantes").insert({
        evento_id: evento!.id,
        nome: "Participante RLS",
        nome_busca: "participante rls",
        documento: `RLS${sufixo.toUpperCase()}`,
        tipo: "convidado",
        codigo,
      });
      expect(erroParticipante).toBeNull();
      const { data } = await b.from("participantes").select("id").eq("codigo", codigo).maybeSingle();
      expect(data).toBeNull();
    });

    it("usuário vê a própria conta e nenhuma outra", async () => {
      const { data } = await a.from("contas").select("id");
      expect(data).toEqual([{ id: contaAId }]);
    });
  },
);
