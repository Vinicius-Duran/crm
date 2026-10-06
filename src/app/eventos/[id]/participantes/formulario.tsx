"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { TIPOS_PARTICIPANTE } from "@/lib/dominio";
import { salvarParticipante } from "./actions";

export type ParticipanteEditavel = {
  id: string;
  nome: string;
  documento: string;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  tipo: string;
};

export function FormularioParticipante({ titulo, eventoId, participante }: { titulo: string; eventoId: string; participante?: ParticipanteEditavel }) {
  const [estado, acao, pendente] = useActionState(salvarParticipante, estadoInicial);
  const v = (campo: keyof ParticipanteEditavel) => estado.valores?.[campo] ?? participante?.[campo] ?? "";
  const e = estado.erros ?? {};
  return (
    <form action={acao}>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="evento_id" value={eventoId} />
          {participante && <input type="hidden" name="id" value={participante.id} />}
          <div className="md:col-span-2">
            <Campo key={`nome-${v("nome")}`} nome="nome" rotulo="Nome" defaultValue={v("nome")} erros={e.nome} required />
          </div>
          <Campo key={`documento-${v("documento")}`} nome="documento" rotulo="CPF ou documento" defaultValue={v("documento")} erros={e.documento} required inputMode="text" />
          <Campo key={`data_nascimento-${v("data_nascimento")}`} nome="data_nascimento" rotulo="Data de nascimento" type="date" defaultValue={v("data_nascimento")} erros={e.data_nascimento} />
          <Campo key={`email-${v("email")}`} nome="email" rotulo="E-mail" type="email" defaultValue={v("email")} erros={e.email} />
          <Campo key={`telefone-${v("telefone")}`} nome="telefone" rotulo="Telefone" type="tel" defaultValue={v("telefone")} erros={e.telefone} />
          <Campo key={`empresa-${v("empresa")}`} nome="empresa" rotulo="Empresa do participante" defaultValue={v("empresa")} erros={e.empresa} />
          <Selecao key={`tipo-${v("tipo") || "convidado"}`} nome="tipo" rotulo="Tipo" opcoes={TIPOS_PARTICIPANTE} defaultValue={v("tipo") || "convidado"} erros={e.tipo} />
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
