import { exigirAdmin } from "@/lib/sessao";
import { FormularioConta } from "../formulario";

export default async function NovaConta() {
  await exigirAdmin();
  return <FormularioConta titulo="Nova conta" />;
}
