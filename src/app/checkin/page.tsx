import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/dominio";
import { Leitor } from "./leitor";

export default async function Checkin() {
  const { data, error } = await db().from("eventos").select("id, nome, data").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  // Evento de hoje (fuso de Brasília) já vem selecionado; sem evento hoje, lê de qualquer um.
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const eventos = data.map((e) => ({ id: e.id as string, rotulo: `${e.nome} · ${formatarData(e.data as string)}` }));
  return <Leitor eventos={eventos} padrao={data.find((e) => e.data === hoje)?.id ?? ""} />;
}
