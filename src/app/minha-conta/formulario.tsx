"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { trocarSenha } from "./actions";

export function FormularioSenha() {
  const [estado, acao, pendente] = useActionState(trocarSenha, estadoInicial);
  const e = estado.erros ?? {};
  // Não há para onde redirecionar depois de trocar a senha: fica na própria página.
  useEffect(() => {
    if (estado.ok && estado.mensagem) toast.success(estado.mensagem);
  }, [estado]);
  return (
    <form action={acao}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Campo nome="senha" rotulo="Nova senha" type="password" erros={e.senha} required />
          <Campo nome="confirmacao" rotulo="Confirmar senha" type="password" erros={e.confirmacao} required />
          {!estado.ok && !estado.erros && <p className="text-sm text-destructive md:col-span-2">{estado.mensagem}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Trocar senha"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
