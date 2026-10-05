"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { salvarEmpresa } from "./actions";

export function FormularioEmpresa({ titulo, empresa }: { titulo: string; empresa?: { id: string; nome: string } }) {
  const [estado, acao, pendente] = useActionState(salvarEmpresa, estadoInicial);
  return (
    <form action={acao}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {empresa && <input type="hidden" name="id" value={empresa.id} />}
          <div className="md:col-span-2">
            <Campo
              key={estado.valores?.nome ?? empresa?.nome}
              nome="nome"
              rotulo="Nome"
              defaultValue={estado.valores?.nome ?? empresa?.nome}
              erros={estado.erros?.nome}
              required
            />
          </div>
          {!estado.ok && !estado.erros && <p className="text-sm text-destructive md:col-span-2">{estado.mensagem}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
