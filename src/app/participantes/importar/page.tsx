import Link from "next/link";
import { db } from "@/lib/supabase";
import { COLUNAS } from "@/lib/planilha";
import { Importador } from "./importador";

export default async function Importar() {
  const { data: eventos, error } = await db().from("eventos").select("id, nome").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Importar planilha</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Colunas esperadas: <code>{COLUNAS.join(", ")}</code>. Obrigatórias: nome, documento e tipo.{" "}
        <Link href="/participantes/modelo" className="underline">Baixar o modelo</Link>.
      </p>
      <Importador eventos={eventos} />
    </section>
  );
}
