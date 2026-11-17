"use server";

import { redirect } from "next/navigation";
import { dbUsuario } from "@/lib/supabase";
import { entrarSchema } from "@/lib/dominio";
import { destinoSeguro } from "@/lib/navegacao";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function entrar(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = entrarSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const banco = await dbUsuario();
  const { error } = await banco.auth.signInWithPassword({ email: r.data.email, password: r.data.senha });
  if (error) return { ok: false, mensagem: "E-mail ou senha incorretos", valores: { email: valores.email } };
  redirect(destinoSeguro(r.data.proximo));
}

export async function sair(): Promise<void> {
  const banco = await dbUsuario();
  await banco.auth.signOut();
  redirect("/entrar");
}
