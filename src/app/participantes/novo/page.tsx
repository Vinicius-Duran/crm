import { listarEmpresas } from "@/lib/busca";
import { FormularioParticipante } from "../formulario";

export default async function NovoParticipante() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo participante</h1>
      <FormularioParticipante empresas={await listarEmpresas()} />
    </section>
  );
}
