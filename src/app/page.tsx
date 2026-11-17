import { redirect } from "next/navigation";
import { inicioDe } from "@/lib/navegacao";
import { exigirUsuario } from "@/lib/sessao";

export default async function Inicio() {
  const usuario = await exigirUsuario();
  redirect(inicioDe({ papel: usuario.papel, adminPlataforma: usuario.adminPlataforma, modulos: usuario.conta.modulos }));
}
