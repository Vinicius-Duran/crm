import { notFound } from "next/navigation";
import { ehUuid } from "@/lib/dominio";
import { db } from "@/lib/supabase";
import { Importador } from "./importador";

export default async function Importar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data: evento } = await db().from("eventos").select("nome").eq("id", id).maybeSingle();
  if (!evento) notFound();
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">Participantes da planilha entram em {evento.nome}.</p>
      </div>
      <Importador eventoId={id} />
    </section>
  );
}
