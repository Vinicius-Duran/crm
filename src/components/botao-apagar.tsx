"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EstadoAcao } from "@/lib/acao";

export function BotaoApagar({ acao, confirmacao, rotulo = "Apagar" }: { acao: () => Promise<EstadoAcao>; confirmacao: string; rotulo?: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pendente}
      onClick={() => {
        if (!window.confirm(confirmacao)) return;
        iniciar(async () => {
          const r = await acao();
          if (r.ok) toast.success(r.mensagem);
          else toast.error(r.mensagem);
        });
      }}
    >
      {rotulo}
    </Button>
  );
}
