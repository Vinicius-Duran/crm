import { Card, CardContent } from "@/components/ui/card";
import { TabelaUsuarios } from "@/components/tabela-usuarios";
import { exigirDono } from "@/lib/sessao";
import { listarUsuariosDaConta } from "@/lib/usuarios";
import { FormularioUsuario } from "./formulario";
import { alternarAtivo, redefinirSenhaDe } from "./actions";

export default async function Usuarios() {
  const dono = await exigirDono();
  const usuarios = await listarUsuariosDaConta(dono.conta.id);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="text-sm text-muted-foreground">Usuários da conta {dono.conta.nome}.</p>
      </div>
      <FormularioUsuario />
      <Card>
        <CardContent>
          <TabelaUsuarios usuarios={usuarios} redefinirSenha={redefinirSenhaDe} alternarAtivo={alternarAtivo} protegerAdmin />
        </CardContent>
      </Card>
    </section>
  );
}
