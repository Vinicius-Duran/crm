import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirUsuario } from "@/lib/sessao";
import { PAPEIS } from "@/lib/dominio";
import { FormularioSenha } from "./formulario";

export default async function MinhaConta() {
  const usuario = await exigirUsuario();

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Minha conta</h1>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Nome</p>
            <p>{usuario.nome}</p>
          </div>
          <div>
            <p className="text-muted-foreground">E-mail</p>
            <p>{usuario.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Conta</p>
            <p>{usuario.conta.nome}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Papel</p>
            <p>{PAPEIS[usuario.papel]}</p>
          </div>
        </CardContent>
      </Card>
      <FormularioSenha />
    </section>
  );
}
