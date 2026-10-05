"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importar, previsualizar, type Previa } from "./actions";

export function Importador({ eventos }: { eventos: { id: string; nome: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const dados = () => new FormData(formRef.current!);

  return (
    <div className="grid gap-6">
      <form ref={formRef} className="grid max-w-xl gap-4" onChange={() => setPrevia(null)}>
        <div className="grid gap-1.5">
          <Label htmlFor="arquivo">Planilha (CSV ou Excel)</Label>
          <input id="arquivo" name="arquivo" type="file" accept=".csv,.xlsx,.xls" required className="text-sm" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="evento_id">Inscrever todos no evento (opcional)</Label>
          <select id="evento_id" name="evento_id" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="">Não inscrever</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pendente}
          className="justify-self-start"
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
      </form>

      {previa && (
        <div className="grid gap-4">
          <p className="text-sm">
            <strong>{previa.novos}</strong> novos · <strong>{previa.existentes}</strong> já cadastrados (serão atualizados com os dados da planilha) ·{" "}
            <strong className={previa.comErro ? "text-destructive" : undefined}>{previa.comErro}</strong> com erro (não serão gravados)
          </p>
          {previa.comErro > 0 && (
            <ul className="grid gap-1 text-sm text-destructive">
              {previa.linhas.flatMap((l) => (l.ok ? [] : [<li key={l.linha}>Linha {l.linha}: {l.erros.join("; ")}</li>]))}
            </ul>
          )}
          <Button
            type="button"
            disabled={pendente || previa.novos + previa.existentes === 0}
            className="justify-self-start"
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
        </div>
      )}
    </div>
  );
}
