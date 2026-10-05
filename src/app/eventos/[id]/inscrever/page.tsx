import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/supabase";
import { buscarParticipantes } from "@/lib/busca";
import { ehUuid, TIPOS_PARTICIPANTE } from "@/lib/dominio";
import { inscreverSelecionados } from "../../actions";

export default async function Inscrever({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { q = "" } = await searchParams;
  const [{ data: evento }, { data: jaInscritos }, participantes] = await Promise.all([
    db().from("eventos").select("id, nome").eq("id", id).maybeSingle(),
    db().from("inscricoes").select("participante_id").eq("evento_id", id),
    buscarParticipantes({ termo: q, limite: 500 }),
  ]);
  if (!evento) notFound();
  const inscritos = new Set((jaInscritos ?? []).map((i) => i.participante_id as string));

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Inscrever em {evento.nome}</h1>
      <form className="flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Nome ou CPF" aria-label="Buscar participante" />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>
      <form action={inscreverSelecionados} className="grid gap-3">
        <input type="hidden" name="evento_id" value={id} />
        <ul className="grid gap-1">
          {participantes.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                <input type="checkbox" name="participante" value={p.id} disabled={inscritos.has(p.id)} defaultChecked={inscritos.has(p.id)} className="size-4" />
                <span>{p.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {TIPOS_PARTICIPANTE[p.tipo]}{p.empresa ? ` · ${p.empresa.nome}` : ""}{inscritos.has(p.id) ? " · já inscrito" : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Button type="submit" className="justify-self-start">Inscrever selecionados</Button>
      </form>
    </section>
  );
}
