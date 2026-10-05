"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { TIPOS_EVENTO } from "@/lib/dominio";
import { salvarEvento } from "./actions";

export function FormularioEvento({ evento }: { evento?: { id: string; nome: string; tipo: string; data: string } }) {
  const [estado, acao, pendente] = useActionState(salvarEvento, estadoInicial);
  const e = estado.erros ?? {};
  const nome = estado.valores?.nome ?? evento?.nome;
  const tipo = estado.valores?.tipo ?? evento?.tipo ?? "palestra";
  const data = estado.valores?.data ?? evento?.data;
  return (
    <form action={acao} className="grid max-w-md gap-4">
      {evento && <input type="hidden" name="id" value={evento.id} />}
      <Campo key={`nome-${nome}`} nome="nome" rotulo="Nome do evento" defaultValue={nome} erros={e.nome} required />
      <Selecao key={`tipo-${tipo}`} nome="tipo" rotulo="Tipo" opcoes={TIPOS_EVENTO} defaultValue={tipo} erros={e.tipo} />
      <Campo key={`data-${data}`} nome="data" rotulo="Data" type="date" defaultValue={data} erros={e.data} required />
      {!estado.ok && !estado.erros && <p className="text-sm text-destructive">{estado.mensagem}</p>}
      <Button type="submit" disabled={pendente} className="justify-self-start">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
