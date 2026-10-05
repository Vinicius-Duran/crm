import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { buscarParticipantes, listarEmpresas } from "@/lib/busca";
import { TIPOS_PARTICIPANTE } from "@/lib/dominio";
import { iniciais } from "@/lib/texto";
import { apagarParticipante } from "./actions";

const LIMITE = 200;

export default async function Participantes({ searchParams }: { searchParams: Promise<{ q?: string; empresa?: string; tipo?: string }> }) {
  const { q = "", empresa = "", tipo = "" } = await searchParams;
  const [participantes, empresas] = await Promise.all([
    buscarParticipantes({ termo: q, empresaId: empresa, tipo, limite: LIMITE }),
    listarEmpresas(),
  ]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Participantes</h1>
          <p className="text-sm text-muted-foreground">Pessoas cadastradas, com empresa e tipo de cada uma.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/participantes/importar" className={buttonVariants({ variant: "outline" })}>Importar planilha</Link>
          <Link href="/participantes/novo" className={buttonVariants()}>Novo participante</Link>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4">
          <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <Input name="q" defaultValue={q} placeholder="Nome ou CPF" aria-label="Buscar por nome ou CPF" />
            <select name="empresa" defaultValue={empresa} aria-label="Filtrar por empresa" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
              <option value="">Todas as empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            <select name="tipo" defaultValue={tipo} aria-label="Filtrar por tipo" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
              <option value="">Todos os tipos</option>
              {Object.entries(TIPOS_PARTICIPANTE).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
            <Button type="submit" variant="outline">Buscar</Button>
          </form>

          {participantes.length === LIMITE && (
            <p className="text-sm text-muted-foreground">Mostrando os primeiros {LIMITE}. Refine a busca para ver outros.</p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{iniciais(p.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="grid">
                        <Link href={`/participantes/${p.id}`} className="font-medium hover:underline">{p.nome}</Link>
                        {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.documento}</TableCell>
                  <TableCell>{p.empresa?.nome ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[p.tipo]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <BotaoApagar acao={apagarParticipante.bind(null, p.id)} confirmacao={`Apagar ${p.nome} e todas as inscrições dele?`} />
                  </TableCell>
                </TableRow>
              ))}
              {participantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Nenhum participante encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
