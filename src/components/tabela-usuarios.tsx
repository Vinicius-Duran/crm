import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { PAPEIS } from "@/lib/dominio";
import type { EstadoAcao } from "@/lib/acao";
import type { Papel } from "@/lib/sessao";

type Linha = { id: string; nome: string; email: string; papel: Papel; adminPlataforma: boolean; desativado: boolean };
type Acao = (id: string) => Promise<EstadoAcao>;

// Usuários de uma conta, em /usuarios (o dono) e em /admin/contas/[id] (a plataforma). Com
// `protegerAdmin`, a linha de quem tem admin_plataforma sai sem ações: o dono não mexe nesse
// usuário (decisão do autor na #40). A Server Action do dono recusa do mesmo jeito.
export function TabelaUsuarios({
  usuarios,
  redefinirSenha,
  alternarAtivo,
  protegerAdmin = false,
}: {
  usuarios: Linha[];
  redefinirSenha: Acao;
  alternarAtivo: Acao;
  protegerAdmin?: boolean;
}) {
  return (
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
              {protegerAdmin && u.adminPlataforma ? (
                <p className="text-right text-xs text-muted-foreground">Administrador da plataforma</p>
              ) : (
                <div className="flex justify-end gap-2">
                  <BotaoApagar
                    acao={redefinirSenha.bind(null, u.id)}
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
              )}
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
  );
}
