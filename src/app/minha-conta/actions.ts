"use server";

import { dbUsuario } from "@/lib/supabase";
import { novaSenhaSchema } from "@/lib/dominio";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function trocarSenha(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = novaSenhaSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const { error } = await (await dbUsuario()).auth.updateUser({ password: r.data.senha });
  if (error) return { ok: false, mensagem: error.message, valores };
  return { ok: true, mensagem: "Senha alterada" };
}
