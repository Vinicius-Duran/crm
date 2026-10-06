"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { COLUNAS } from "@/lib/planilha";
import { importar, previsualizar, type Previa } from "./actions";

const FALHA_REDE = "Falha ao falar com o servidor. Tente de novo.";

export function Importador({ eventoId }: { eventoId: string }) {
  // Cópia em memória do arquivo escolhido. No Android, o arquivo vindo do WhatsApp ou do Drive pode
  // deixar de ser legível depois de escolhido; lido na hora, os dois envios usam estes bytes.
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const dados = () => {
    const form = new FormData();
    if (arquivo) form.set("arquivo", arquivo);
    return form;
  };

  return (
    <div className="grid gap-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Enviar planilha</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Colunas esperadas:{" "}
            {COLUNAS.map((c, i) => (
              <span key={c}>
                {i > 0 && ", "}
                <code className="font-mono">{c}</code>
              </span>
            ))}
            . Obrigatórias: nome, documento e tipo.{" "}
            <Link href="/modelo-planilha" className="underline">Baixar o modelo</Link>.
          </p>
          <Campo
            nome="arquivo"
            rotulo="Planilha (CSV ou Excel)"
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            required
            onChange={async (e) => {
              const campo = e.currentTarget;
              const escolhido = campo.files?.[0];
              setPrevia(null);
              setArquivo(null);
              if (!escolhido) return;
              try {
                setArquivo(new File([await escolhido.arrayBuffer()], escolhido.name, { type: escolhido.type }));
              } catch {
                campo.value = "";
                toast.error("Não consegui abrir o arquivo. Escolha de novo.");
              }
            }}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pendente || !arquivo}
            onClick={() =>
              iniciar(async () => {
                try {
                  const r = await previsualizar(eventoId, dados());
                  if (r.ok) setPrevia(r.previa);
                  else toast.error(r.mensagem);
                } catch {
                  toast.error(FALHA_REDE);
                }
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
              <Badge variant="secondary">{previa.existentes} já no evento</Badge>
              {previa.comErro > 0 && <Badge variant="destructive">{previa.comErro} com erro</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Quem já está no evento é atualizado com os dados da planilha e mantém o QR{previa.comErro > 0 ? "; linhas com erro não serão gravadas." : "."}
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
                  try {
                    const r = await importar(eventoId, dados());
                    if (!r.ok) return void toast.error(r.mensagem);
                    toast.success(r.mensagem);
                    router.push(`/eventos/${eventoId}`);
                  } catch {
                    toast.error(FALHA_REDE);
                  }
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
