import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { db } from "@/lib/supabase";
import { limparTermo } from "@/lib/texto";
import { apagarEmpresa } from "./actions";

export default async function Empresas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  let consulta = db().from("empresas").select("id, nome, participantes(count)").order("nome");
  const termo = limparTermo(q);
  if (termo) consulta = consulta.ilike("nome", `%${termo}%`);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const empresas = data as unknown as { id: string; nome: string; participantes: { count: number }[] }[];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-muted-foreground">Empresas cadastradas e quantos participantes cada uma tem.</p>
        </div>
        <Link href="/empresas/novo" className={buttonVariants()}>Nova empresa</Link>
      </div>
      <Card>
        <CardContent className="grid gap-4">
          <form className="flex max-w-md gap-2">
            <Input name="q" defaultValue={q} placeholder="Buscar por nome" aria-label="Buscar empresa" />
            <Button type="submit" variant="outline">Buscar</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Participantes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/empresas/${e.id}`} className="hover:underline">{e.nome}</Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.participantes[0]?.count ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <BotaoApagar acao={apagarEmpresa.bind(null, e.id)} confirmacao={`Apagar a empresa ${e.nome}?`} />
                  </TableCell>
                </TableRow>
              ))}
              {empresas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">Nenhuma empresa encontrada.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
