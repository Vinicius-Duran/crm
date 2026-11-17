"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { EstadoAcao } from "@/lib/acao";
import type { VariantProps } from "class-variance-authority";

type Variante = VariantProps<typeof buttonVariants>["variant"];

export function BotaoApagar({
  acao,
  confirmacao,
  rotulo = "Apagar",
  variant = "destructive",
}: { acao: () => Promise<EstadoAcao>; confirmacao: string; rotulo?: string; variant?: Variante }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
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
