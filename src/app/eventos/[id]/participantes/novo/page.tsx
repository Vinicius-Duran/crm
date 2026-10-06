import { notFound } from "next/navigation";
import { ehUuid } from "@/lib/dominio";
import { db } from "@/lib/supabase";
import { FormularioParticipante } from "../formulario";

export default async function NovoParticipante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data: evento } = await db().from("eventos").select("nome").eq("id", id).maybeSingle();
  if (!evento) notFound();
  return <FormularioParticipante titulo={`Novo participante em ${evento.nome}`} eventoId={id} />;
}
