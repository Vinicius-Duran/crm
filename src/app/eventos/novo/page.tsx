import { FormularioEvento } from "../formulario";

export default function NovoEvento() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo evento</h1>
      <FormularioEvento />
    </section>
  );
}
