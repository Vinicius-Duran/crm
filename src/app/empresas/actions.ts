"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbUsuario } from "@/lib/supabase";
import { empresaSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarEmpresa(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = empresaSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const banco = await dbUsuario();
  const { error } = valores.id
    ? await banco.from("empresas").update(r.data).eq("id", valores.id)
    : await banco.from("empresas").insert(r.data);
  if (error) return { ok: false, mensagem: mensagemErro(error, "Já existe uma empresa com esse nome"), valores };
  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function apagarEmpresa(id: string): Promise<EstadoAcao> {
  const { error } = await (await dbUsuario()).from("empresas").delete().eq("id", id);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath("/empresas");
  return { ok: true, mensagem: "Empresa apagada" };
}
