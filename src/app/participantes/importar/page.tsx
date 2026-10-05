import { db } from "@/lib/supabase";
import { Importador } from "./importador";

export default async function Importar() {
  const { data: eventos, error } = await db().from("eventos").select("id, nome").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">Cadastre participantes em lote a partir de uma planilha.</p>
      </div>
      <Importador eventos={eventos} />
    </section>
  );
}
