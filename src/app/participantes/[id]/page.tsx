import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { listarEmpresas } from "@/lib/busca";
import { FormularioParticipante, type ParticipanteEditavel } from "../formulario";

export default async function EditarParticipante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const [{ data }, empresas] = await Promise.all([
    db().from("participantes").select("id, nome, documento, data_nascimento, email, telefone, empresa_id, tipo").eq("id", id).maybeSingle(),
    listarEmpresas(),
  ]);
  if (!data) notFound();
  return <FormularioParticipante titulo="Editar participante" participante={data as ParticipanteEditavel} empresas={empresas} />;
}
