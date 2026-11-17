"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { PAPEIS } from "@/lib/dominio";
import { salvarUsuario } from "./actions";

export function FormularioUsuario() {
  const [estado, acao, pendente] = useActionState(salvarUsuario, estadoInicial);
  const e = estado.erros ?? {};
  // Não há para onde redirecionar depois de criar: a lista já está nesta mesma página.
  useEffect(() => {
    if (estado.ok && estado.mensagem) toast.success(estado.mensagem);
  }, [estado]);
  const nome = estado.valores?.nome;
  const email = estado.valores?.email;
  const papel = estado.valores?.papel ?? "dono";
  const senha = estado.valores?.senha;
  return (
    <form action={acao}>
      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Campo key={`nome-${nome}`} nome="nome" rotulo="Nome" defaultValue={nome} erros={e.nome} required />
          <Campo key={`email-${email}`} nome="email" rotulo="E-mail" type="email" defaultValue={email} erros={e.email} required />
          <Selecao key={`papel-${papel}`} nome="papel" rotulo="Papel" opcoes={PAPEIS} defaultValue={papel} erros={e.papel} />
          <Campo key={`senha-${senha}`} nome="senha" rotulo="Senha inicial" type="password" defaultValue={senha} erros={e.senha} required />
          {!estado.ok && !estado.erros && <p className="text-sm text-destructive md:col-span-2">{estado.mensagem}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pendente}>
            {pendente ? "Criando…" : "Criar usuário"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
