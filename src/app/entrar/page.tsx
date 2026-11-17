"use client";

import { use, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { entrar } from "./actions";

export default function Entrar({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = use(searchParams);
  const [estado, acao, pendente] = useActionState(entrar, estadoInicial);
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form action={acao} className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {proximo && <input type="hidden" name="proximo" value={proximo} />}
            <Campo
              key={estado.valores?.email}
              nome="email"
              rotulo="E-mail"
              type="email"
              defaultValue={estado.valores?.email}
              erros={estado.erros?.email}
              required
            />
            <Campo nome="senha" rotulo="Senha" type="password" erros={estado.erros?.senha} required />
            {!estado.ok && !estado.erros && <p className="text-sm text-destructive">{estado.mensagem}</p>}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={pendente} className="w-full">
              {pendente ? "Entrando…" : "Entrar"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Esqueceu a senha? Fale com o responsável pela sua conta.</p>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
