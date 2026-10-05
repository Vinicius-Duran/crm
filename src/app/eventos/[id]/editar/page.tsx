import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { FormularioEvento } from "../../formulario";

export default async function EditarEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data } = await db().from("eventos").select("id, nome, tipo, data").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <FormularioEvento titulo="Editar evento" evento={data} />;
}
