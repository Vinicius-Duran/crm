import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { FormularioEmpresa } from "../formulario";

export default async function EditarEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data } = await db().from("empresas").select("id, nome").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Editar empresa</h1>
      <FormularioEmpresa empresa={data} />
    </section>
  );
}
