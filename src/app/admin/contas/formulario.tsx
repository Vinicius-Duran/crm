"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { MODULOS } from "@/lib/dominio";
import { slugDe } from "@/lib/texto";
import { salvarConta } from "./actions";

const FUSOS = {
  "America/Sao_Paulo": "São Paulo",
  "America/Manaus": "Manaus",
  "America/Fortaleza": "Fortaleza",
  "America/Cuiaba": "Cuiabá",
};

export type ContaEditavel = { id: string; nome: string; slug: string; modulos: string[]; fuso: string };

export function FormularioConta({ titulo, conta }: { titulo: string; conta?: ContaEditavel }) {
  const [estado, acao, pendente] = useActionState(salvarConta, estadoInicial);
  const e = estado.erros ?? {};
  const nome = estado.valores?.nome ?? conta?.nome;
  const modulos = estado.valores ? (estado.valores.modulos ?? "").split(",").filter(Boolean) : (conta?.modulos ?? []);
  const fuso = estado.valores?.fuso ?? conta?.fuso ?? "America/Sao_Paulo";
  const [slug, setSlug] = useState(conta?.slug ?? "");
  // Numa conta nova o slug acompanha o nome até ser editado à mão. Numa conta existente ele não
  // muda sozinho: é o endereço público da conta, e renomear não deveria trocá-lo.
  const [slugManual, setSlugManual] = useState(Boolean(conta));
  return (
    <form action={acao}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {conta && <input type="hidden" name="id" value={conta.id} />}
          <Campo
            key={`nome-${nome}`}
            id="conta-nome"
            nome="nome"
            rotulo="Nome"
            defaultValue={nome}
            erros={e.nome}
            onChange={(ev) => {
              if (!slugManual) setSlug(slugDe(ev.target.value));
            }}
            required
          />
          <Campo
            nome="slug"
            rotulo="Slug"
            value={slug}
            erros={e.slug}
            onChange={(ev) => {
              setSlugManual(true);
              setSlug(ev.target.value);
            }}
            required
          />
          <fieldset key={`modulos-${modulos.join()}`} className="grid gap-1.5" aria-describedby={e.modulos ? "modulos-erro" : undefined}>
            <legend className="mb-1.5 text-sm leading-none font-medium">Módulos</legend>
            <div className="flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2">
              {Object.entries(MODULOS).map(([valor, texto]) => (
                <label key={valor} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="modulos" value={valor} defaultChecked={modulos.includes(valor)} className="size-4 accent-primary" />
                  {texto}
                </label>
              ))}
            </div>
            {e.modulos?.map((m) => (
              <p key={m} id="modulos-erro" className="text-sm text-destructive">
                {m}
              </p>
            ))}
          </fieldset>
          <Selecao key={`fuso-${fuso}`} nome="fuso" rotulo="Fuso horário" opcoes={FUSOS} defaultValue={fuso} erros={e.fuso} />
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
