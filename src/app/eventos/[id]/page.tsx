import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { db } from "@/lib/supabase";
import { emailConfigurado } from "@/lib/email";
import { iniciais } from "@/lib/texto";
import { paginar } from "@/lib/paginacao";
import { ehUuid, formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "@/lib/dominio";
import { apagarEvento } from "../actions";
import { apagarParticipante } from "./participantes/actions";
import { EnvioEmail, BotaoEmailUm } from "./envio-email";

type Participante = {
  id: string;
  nome: string;
  email: string | null;
  empresa: string | null;
  tipo: TipoParticipante;
  codigo: string;
  checkin_em: string | null;
  email_enviado_em: string | null;
  email_erro: string | null;
};

const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const POR_PAGINA = 20;
const numero = (n: number) => n.toLocaleString("pt-BR");

export default async function Evento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { pagina: paginaPedida } = await searchParams;
  // Contagens feitas pelo banco: o PostgREST devolve no máximo 1.000 linhas, então contar a lista erraria.
  const contar = () => db().from("participantes").select("id", { count: "exact", head: true }).eq("evento_id", id);
  const [{ data: evento }, { count: total, error: e1 }, { count: presentes, error: e2 }] = await Promise.all([
    db().from("eventos").select("id, nome, tipo, data, empresa:empresas(id, nome)").eq("id", id).maybeSingle(),
    contar(),
    contar().not("checkin_em", "is", null),
  ]);
  if (!evento) notFound();
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const pag = paginar(paginaPedida, total ?? 0, POR_PAGINA);
  const { data, error } = await db()
    .from("participantes")
    .select("id, nome, email, empresa, tipo, codigo, checkin_em, email_enviado_em, email_erro")
    .eq("evento_id", id)
    .order("nome_busca")
    .order("id")
    .range(pag.de, pag.ate);
  if (error) throw new Error(error.message);
  const empresa = evento.empresa as unknown as { id: string; nome: string };
  const participantes = data as Participante[];
  const inscritos = total ?? 0;
  const vieram = presentes ?? 0;
  const configurado = emailConfigurado();
  const link = (n: number) => `/eventos/${id}?pagina=${n}`;

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/empresas/${empresa.id}`} className="text-sm font-medium text-muted-foreground hover:underline">{empresa.nome}</Link>
          <h1 className="text-2xl font-semibold">{evento.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{TIPOS_EVENTO[evento.tipo as TipoEvento]}</Badge>
            {formatarData(evento.data)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/eventos/${id}/participantes/novo`} className={buttonVariants()}>Adicionar participante</Link>
          <Link href={`/eventos/${id}/importar`} className={buttonVariants({ variant: "outline" })}>Importar planilha</Link>
          <a href={`/eventos/${id}/csv`} className={buttonVariants({ variant: "outline" })}>Exportar CSV</a>
          <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
          <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
          <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todos os participantes dele?`} rotulo="Apagar evento" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">Participantes</p>
            <p className="text-2xl font-semibold tabular-nums">{numero(inscritos)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">Presentes</p>
            <p className="text-2xl font-semibold tabular-nums" aria-label="Presentes sobre participantes">
              {numero(vieram)}/{numero(inscritos)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">Faltam</p>
            <p className="text-2xl font-semibold tabular-nums">{numero(inscritos - vieram)}</p>
          </CardContent>
        </Card>
      </div>

      <EnvioEmail eventoId={id} configurado={configurado} />

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participante</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>E-mail</TableHead>
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
                        <Link href={`/eventos/${id}/participantes/${p.id}`} className="font-medium hover:underline">{p.nome}</Link>
                        {p.empresa && <span className="text-xs text-muted-foreground">{p.empresa}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[p.tipo]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                  <TableCell>
                    {p.checkin_em ? (
                      <Badge className="bg-sucesso/10 text-sucesso">{hora(p.checkin_em)}</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.email_enviado_em ? `Enviado ${hora(p.email_enviado_em)}` : p.email_erro ? <span className="text-destructive">{p.email_erro}</span> : p.email ? "Não enviado" : "Sem e-mail"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <a href={`/credenciais/${p.id}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>PDF</a>
                      {configurado && p.email && <BotaoEmailUm participanteId={p.id} />}
                      <BotaoApagar acao={apagarParticipante.bind(null, p.id, id)} confirmacao={`Remover ${p.nome} deste evento?`} rotulo="Remover" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {participantes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Nenhum participante ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {pag.paginas > 1 && (
            <nav aria-label="Páginas de participantes" className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {numero(pag.de + 1)}–{numero(Math.min(pag.ate + 1, inscritos))} de {numero(inscritos)} · página {numero(pag.pagina)} de {numero(pag.paginas)}
              </p>
              <div className="flex gap-2">
                {pag.pagina > 1 ? (
                  <Link href={link(pag.pagina - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Anterior</Link>
                ) : (
                  <span aria-disabled="true" className={buttonVariants({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>Anterior</span>
                )}
                {pag.pagina < pag.paginas ? (
                  <Link href={link(pag.pagina + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Próxima</Link>
                ) : (
                  <span aria-disabled="true" className={buttonVariants({ variant: "outline", size: "sm", className: "pointer-events-none opacity-50" })}>Próxima</span>
                )}
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
