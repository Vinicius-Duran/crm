import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabelaUsuarios } from "@/components/tabela-usuarios";
import { FormularioUsuario } from "@/app/usuarios/formulario";
import { exigirAdmin } from "@/lib/sessao";
import { dbServico } from "@/lib/supabase";
import { ehUuid } from "@/lib/dominio";
import { listarUsuariosDaConta } from "@/lib/usuarios";
import { FormularioConta } from "../formulario";
import { alternarAtivoAdmin, redefinirSenhaAdmin, salvarUsuarioDaConta } from "../actions";

export default async function Conta({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data: conta } = await dbServico().from("contas").select("id, nome, slug, modulos, fuso").eq("id", id).maybeSingle();
  if (!conta) notFound();
  const usuarios = await listarUsuariosDaConta(id);

  return (
    <section className="grid gap-4">
      <FormularioConta titulo="Editar conta" conta={conta} />
      <FormularioUsuario salvar={salvarUsuarioDaConta} contaId={id} />
      <Card>
        <CardHeader>
          <CardTitle>Usuários de {conta.nome}</CardTitle>
        </CardHeader>
        <CardContent>
          <TabelaUsuarios usuarios={usuarios} redefinirSenha={redefinirSenhaAdmin} alternarAtivo={alternarAtivoAdmin} />
        </CardContent>
      </Card>
    </section>
  );
}
