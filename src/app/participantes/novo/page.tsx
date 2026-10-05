import { listarEmpresas } from "@/lib/busca";
import { FormularioParticipante } from "../formulario";

export default async function NovoParticipante() {
  return <FormularioParticipante titulo="Novo participante" empresas={await listarEmpresas()} />;
}
