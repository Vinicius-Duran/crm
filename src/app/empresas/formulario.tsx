"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { salvarEmpresa } from "./actions";

export function FormularioEmpresa({ empresa }: { empresa?: { id: string; nome: string } }) {
  const [estado, acao, pendente] = useActionState(salvarEmpresa, estadoInicial);
  return (
    <form action={acao} className="grid max-w-md gap-4">
      {empresa && <input type="hidden" name="id" value={empresa.id} />}
      <Campo
        key={estado.valores?.nome ?? empresa?.nome}
        nome="nome"
        rotulo="Nome"
        defaultValue={estado.valores?.nome ?? empresa?.nome}
        erros={estado.erros?.nome}
        required
      />
      {!estado.ok && !estado.erros && <p className="text-sm text-destructive">{estado.mensagem}</p>}
      <Button type="submit" disabled={pendente} className="justify-self-start">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
