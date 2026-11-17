import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Base = { nome: string; rotulo: string; erros?: string[] };

// `id` é o `nome` por padrão; muda só quando dois formulários da mesma página têm um campo de mesmo nome.
function Moldura({ id, rotulo, erros, children }: { id: string; rotulo: string; erros?: string[]; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {erros?.map((e) => (
        <p key={e} id={`${id}-erro`} className="text-sm text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}

export function Campo({ nome, rotulo, erros, id = nome, ...props }: Base & ComponentProps<typeof Input>) {
  return (
    <Moldura id={id} rotulo={rotulo} erros={erros}>
      <Input id={id} name={nome} aria-invalid={erros ? true : undefined} aria-describedby={erros ? `${id}-erro` : undefined} {...props} />
    </Moldura>
  );
}

// <select> nativo: acessível, funciona no celular e dispensa o Select do Base UI.
export function Selecao({
  nome,
  rotulo,
  erros,
  opcoes,
  vazio,
  ...props
}: Base & { opcoes: Record<string, string>; vazio?: string } & ComponentProps<"select">) {
  return (
    <Moldura id={nome} rotulo={rotulo} erros={erros}>
      <select
        id={nome}
        name={nome}
        aria-invalid={erros ? true : undefined}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...props}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {Object.entries(opcoes).map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </Moldura>
  );
}
