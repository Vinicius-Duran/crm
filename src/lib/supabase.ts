import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

let cliente: SupabaseClient | undefined;

// Chave service_role: ignora RLS. Por isso este módulo é server-only — importá-lo num
// componente de cliente quebra o build em vez de vazar a chave para o navegador.
// Restrito a src/app/admin/**, src/lib/usuarios.ts, src/lib/supabase.ts e scripts/**
// (src/lib/supabase.test.ts garante que nenhum outro arquivo a importa).
export function dbServico(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente");
  cliente = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}

// Cliente com o token da sessão do cookie: é o padrão em páginas, Server Actions e rotas
// autenticadas. As respostas passam pelo RLS, então cada conta só vê os próprios dados.
export async function dbUsuario(): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("Faltam SUPABASE_URL e SUPABASE_ANON_KEY no ambiente");
  const cookieStore = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component não pode escrever cookie; o proxy.ts renova a sessão a cada pedido.
        }
      },
    },
  });
}
