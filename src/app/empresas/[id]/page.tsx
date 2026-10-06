import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/supabase";
import { ehUuid, formatarData, TIPOS_EVENTO, type TipoEvento } from "@/lib/dominio";
import { FormularioEmpresa } from "../formulario";

// A empresa é o começo do trabalho: dados dela e, embaixo, os eventos que pertencem a ela.
export default async function Empresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const [{ data: empresa }, { data, error }] = await Promise.all([
    db().from("empresas").select("id, nome").eq("id", id).maybeSingle(),
    db().from("eventos").select("id, nome, tipo, data").eq("empresa_id", id).order("data", { ascending: false }),
  ]);
  if (!empresa) notFound();
  if (error) throw new Error(error.message);
  const eventos = data as { id: string; nome: string; tipo: TipoEvento; data: string }[];

  return (
    <section className="grid gap-4">
      <FormularioEmpresa titulo="Editar empresa" empresa={empresa} />
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Eventos de {empresa.nome}</CardTitle>
          <Link href={`/eventos/novo?empresa=${id}`} className={buttonVariants()}>Novo evento</Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums">{formatarData(e.data)}</TableCell>
                  <TableCell>
                    <Link href={`/eventos/${e.id}`} className="hover:underline">{e.nome}</Link>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{TIPOS_EVENTO[e.tipo]}</Badge></TableCell>
                </TableRow>
              ))}
              {eventos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">Nenhum evento desta empresa ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
