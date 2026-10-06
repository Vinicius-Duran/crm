import { redirect } from "next/navigation";

// O breadcrumb de /eventos/<id>/participantes/novo aponta para cá; a lista mora na tela do evento.
export default async function Participantes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/eventos/${id}`);
}
