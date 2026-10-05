"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Selecao } from "@/components/campo";
import { COLUNAS } from "@/lib/planilha";
import { importar, previsualizar, type Previa } from "./actions";

export function Importador({ eventos }: { eventos: { id: string; nome: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const dados = () => new FormData(formRef.current!);

  return (
    <div className="grid gap-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Enviar planilha</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={formRef} className="grid gap-4" onChange={() => setPrevia(null)}>
            <p className="text-sm text-muted-foreground">
              Colunas esperadas:{" "}
              {COLUNAS.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <code className="font-mono">{c}</code>
                </span>
              ))}
              . Obrigatórias: nome, documento e tipo.{" "}
              <Link href="/participantes/modelo" className="underline">Baixar o modelo</Link>.
            </p>
            <Campo nome="arquivo" rotulo="Planilha (CSV ou Excel)" type="file" accept=".csv,.xlsx,.xls" required />
            <Selecao
              nome="evento_id"
              rotulo="Inscrever todos no evento (opcional)"
              vazio="Não inscrever"
              opcoes={Object.fromEntries(eventos.map((e) => [e.id, e.nome]))}
            />
          </form>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await previsualizar(dados());
                if (r.ok) setPrevia(r.previa);
                else toast.error(r.mensagem);
              })
            }
          >
            {pendente && !previa ? "Lendo…" : "Ver prévia"}
          </Button>
        </CardFooter>
      </Card>

      {previa && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Prévia</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sucesso/10 text-sucesso">{previa.novos} novos</Badge>
              <Badge variant="secondary">{previa.existentes} já cadastrados</Badge>
              {previa.comErro > 0 && <Badge variant="destructive">{previa.comErro} com erro</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Já cadastrados serão atualizados com os dados da planilha{previa.comErro > 0 ? "; linhas com erro não serão gravadas." : "."}
            </p>
            {previa.comErro > 0 && (
              <ul className="grid gap-1 text-sm text-destructive">
                {previa.linhas.flatMap((l) => (l.ok ? [] : [<li key={l.linha}>Linha {l.linha}: {l.erros.join("; ")}</li>]))}
              </ul>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="button"
              disabled={pendente || previa.novos + previa.existentes === 0}
              onClick={() =>
                iniciar(async () => {
                  const r = await importar(dados());
                  if (!r.ok) return void toast.error(r.mensagem);
                  toast.success(r.mensagem);
                  router.push("/participantes");
                })
              }
            >
              {pendente ? "Gravando…" : `Gravar ${previa.novos + previa.existentes} participantes`}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
