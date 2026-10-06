import { notFound } from "next/navigation";
import { ehUuid } from "@/lib/dominio";
import { db } from "@/lib/supabase";
import { FormularioParticipante, type ParticipanteEditavel } from "../formulario";

export default async function EditarParticipante({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  if (!ehUuid(id) || !ehUuid(pid)) notFound();
  const { data } = await db()
    .from("participantes")
    .select("id, nome, documento, data_nascimento, email, telefone, empresa, tipo")
    .eq("id", pid)
    .eq("evento_id", id)
    .maybeSingle();
  if (!data) notFound();
  return <FormularioParticipante titulo="Editar participante" eventoId={id} participante={data as ParticipanteEditavel} />;
}
