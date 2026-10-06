import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { listarEmpresas } from "@/lib/busca";
import { FormularioEvento } from "../../formulario";

export default async function EditarEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const [{ data }, empresas] = await Promise.all([
    db().from("eventos").select("id, nome, tipo, data, empresa_id").eq("id", id).maybeSingle(),
    listarEmpresas(),
  ]);
  if (!data) notFound();
  return <FormularioEvento titulo="Editar evento" evento={data} empresas={empresas} />;
}
