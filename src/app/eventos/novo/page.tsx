import { listarEmpresas } from "@/lib/busca";
import { FormularioEvento } from "../formulario";

// Vindo da tela da empresa, chega com ?empresa=<id> e o campo já vem escolhido.
export default async function NovoEvento({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams;
  return <FormularioEvento titulo="Novo evento" empresas={await listarEmpresas()} empresaPadrao={empresa} />;
}
