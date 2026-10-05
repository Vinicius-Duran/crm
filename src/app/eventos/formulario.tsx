"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { TIPOS_EVENTO } from "@/lib/dominio";
import { salvarEvento } from "./actions";

export function FormularioEvento({ titulo, evento }: { titulo: string; evento?: { id: string; nome: string; tipo: string; data: string } }) {
  const [estado, acao, pendente] = useActionState(salvarEvento, estadoInicial);
  const e = estado.erros ?? {};
  const nome = estado.valores?.nome ?? evento?.nome;
  const tipo = estado.valores?.tipo ?? evento?.tipo ?? "palestra";
  const data = estado.valores?.data ?? evento?.data;
  return (
    <form action={acao}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {evento && <input type="hidden" name="id" value={evento.id} />}
          <div className="md:col-span-2">
            <Campo key={`nome-${nome}`} nome="nome" rotulo="Nome do evento" defaultValue={nome} erros={e.nome} required />
          </div>
          <Selecao key={`tipo-${tipo}`} nome="tipo" rotulo="Tipo" opcoes={TIPOS_EVENTO} defaultValue={tipo} erros={e.tipo} />
          <Campo key={`data-${data}`} nome="data" rotulo="Data" type="date" defaultValue={data} erros={e.data} required />
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
