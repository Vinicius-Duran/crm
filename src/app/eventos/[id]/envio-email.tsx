"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enviarEmailInscricao, enviarLoteEmail } from "./email-actions";

export function EnvioEmail({ eventoId, configurado }: { eventoId: string; configurado: boolean }) {
  const [progresso, setProgresso] = useState("");
  const [rodando, iniciar] = useTransition();

  if (!configurado) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        Envio por e-mail desligado. Para ligar, configure <code className="font-mono">RESEND_API_KEY</code> e{" "}
        <code className="font-mono">EMAIL_FROM</code> na Vercel.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
      <Button
        type="button"
        variant="outline"
        disabled={rodando}
        onClick={() =>
          iniciar(async () => {
            let enviados = 0;
            let falhas = 0;
            for (;;) {
              const r = await enviarLoteEmail(eventoId);
              enviados += r.enviados;
              falhas += r.falhas;
              setProgresso(`${enviados} enviados · ${falhas} falhas · ${r.restantes} faltando`);
              if (r.cotaEsgotada) return void toast.error("Cota de e-mails do Resend esgotada. Os que faltam continuam pendentes para depois.");
              // Lote vazio = acabou. Sem isso, um lote vazio com restantes > 0 viraria laço infinito.
              if (r.restantes === 0 || r.enviados + r.falhas === 0) break;
            }
            toast.success(`Envio concluído: ${enviados} enviados, ${falhas} falhas`);
          })
        }
      >
        {rodando ? "Enviando…" : "Enviar e-mail para quem ainda não recebeu"}
      </Button>
      {progresso && <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{progresso}</span>}
    </div>
  );
}

export function BotaoEmailUm({ inscricaoId }: { inscricaoId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await enviarEmailInscricao(inscricaoId);
          if (r.ok) toast.success(r.mensagem);
          else toast.error(r.mensagem);
        })
      }
    >
      E-mail
    </Button>
  );
}
