import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { exigirDono } from "@/lib/sessao";
import { PAPEIS } from "@/lib/dominio";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.nome}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{PAPEIS[u.papel]}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.desativado ? <Badge variant="outline">Desativado</Badge> : <Badge className="bg-sucesso/10 text-sucesso">Ativo</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <BotaoApagar
                        acao={redefinirSenhaDe.bind(null, u.id)}
                        confirmacao={`Gerar uma senha temporária para ${u.nome}?`}
                        rotulo="Redefinir senha"
                        variant="outline"
                      />
                      <BotaoApagar
                        acao={alternarAtivo.bind(null, u.id)}
                        confirmacao={u.desativado ? `Reativar ${u.nome}?` : `Desativar ${u.nome}?`}
                        rotulo={u.desativado ? "Reativar" : "Desativar"}
                        variant={u.desativado ? "outline" : "destructive"}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {usuarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nenhum usuário ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
