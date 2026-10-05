import { FormularioEmpresa } from "../formulario";

export default function NovaEmpresa() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Nova empresa</h1>
      <FormularioEmpresa />
    </section>
  );
}
