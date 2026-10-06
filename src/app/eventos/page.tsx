import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/supabase";
import { formatarData, TIPOS_EVENTO, type TipoEvento } from "@/lib/dominio";

export default async function Eventos() {
  const { data, error } = await db().from("eventos").select("id, nome, tipo, data, empresa:empresas(nome), inscricoes(count)").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  const eventos = data as unknown as { id: string; nome: string; tipo: TipoEvento; data: string; empresa: { nome: string }; inscricoes: { count: number }[] }[];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Eventos</h1>
          <p className="text-sm text-muted-foreground">Eventos cadastrados e o total de inscritos em cada um.</p>
        </div>
        <Link href="/eventos/novo" className={buttonVariants()}>Novo evento</Link>
      </div>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Inscritos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums">{formatarData(e.data)}</TableCell>
                  <TableCell>
                    <Link href={`/eventos/${e.id}`} className="hover:underline">{e.nome}</Link>
                  </TableCell>
                  <TableCell>{e.empresa.nome}</TableCell>
                  <TableCell><Badge variant="secondary">{TIPOS_EVENTO[e.tipo]}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{e.inscricoes[0]?.count ?? 0}</TableCell>
                </TableRow>
              ))}
              {eventos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Nenhum evento cadastrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
