import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exigirAdmin } from "@/lib/sessao";
import { dbServico } from "@/lib/supabase";
import { MODULOS, type Modulo } from "@/lib/dominio";

// Apagar conta fica de fora de propósito (plano, Tarefa 5): o cascade levaria todos os dados dela.
export default async function Contas() {
  await exigirAdmin();
  const { data, error } = await dbServico().from("contas").select("id, nome, slug, modulos, created_at, usuarios(count)").order("nome");
  if (error) throw new Error(error.message);
  const contas = data as unknown as { id: string; nome: string; slug: string; modulos: Modulo[]; created_at: string; usuarios: { count: number }[] }[];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contas</h1>
          <p className="text-sm text-muted-foreground">Contas da plataforma, os módulos ligados e quantos usuários cada uma tem.</p>
        </div>
        <Link href="/admin/contas/novo" className={buttonVariants()}>Nova conta</Link>
      </div>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Módulos</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
                <TableHead className="text-right">Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/admin/contas/${c.id}`} className="hover:underline">{c.nome}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.modulos.map((m) => (
                        <Badge key={m} variant="secondary">{MODULOS[m] ?? m}</Badge>
                      ))}
                      {c.modulos.length === 0 && <span className="text-muted-foreground">Nenhum</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.usuarios[0]?.count ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </TableCell>
                </TableRow>
              ))}
              {contas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Nenhuma conta ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
