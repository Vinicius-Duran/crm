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
import { ehUuid, formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "@/lib/dominio";
import { apagarEvento, removerInscricao } from "../actions";
import { EnvioEmail, BotaoEmailUm } from "./envio-email";

type Inscricao = {
  id: string;
  codigo: string;
  checkin_em: string | null;
  email_enviado_em: string | null;
  email_erro: string | null;
  participante: { nome: string; email: string | null; tipo: TipoParticipante; empresa: { nome: string } | null };
};

const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function Evento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const [{ data: evento }, { data, error }] = await Promise.all([
    db().from("eventos").select("id, nome, tipo, data").eq("id", id).maybeSingle(),
    db()
      .from("inscricoes")
      .select("id, codigo, checkin_em, email_enviado_em, email_erro, participante:participantes(nome, email, tipo, empresa:empresas(nome))")
      .eq("evento_id", id),
  ]);
  if (!evento) notFound();
  if (error) throw new Error(error.message);
  const inscricoes = (data as unknown as Inscricao[]).sort((a, b) => a.participante.nome.localeCompare(b.participante.nome, "pt-BR"));
  const presentes = inscricoes.filter((i) => i.checkin_em).length;
  const configurado = emailConfigurado();

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{evento.nome}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{TIPOS_EVENTO[evento.tipo as TipoEvento]}</Badge>
            {formatarData(evento.data)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/eventos/${id}/inscrever`} className={buttonVariants()}>Inscrever participantes</Link>
          <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
          <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
          <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todas as inscrições?`} rotulo="Apagar evento" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">Inscritos</p>
            <p className="text-2xl font-semibold tabular-nums">{inscricoes.length}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">Presentes</p>
            <p className="text-2xl font-semibold tabular-nums" aria-label="Presentes sobre inscritos">
              {presentes}/{inscricoes.length}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">Faltam</p>
            <p className="text-2xl font-semibold tabular-nums">{inscricoes.length - presentes}</p>
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
              {inscricoes.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>{iniciais(i.participante.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="grid">
                        <span className="font-medium">{i.participante.nome}</span>
                        {i.participante.empresa && <span className="text-xs text-muted-foreground">{i.participante.empresa.nome}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[i.participante.tipo]}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                  <TableCell>
                    {i.checkin_em ? (
                      <Badge className="bg-sucesso/10 text-sucesso">{hora(i.checkin_em)}</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.email_enviado_em ? `Enviado ${hora(i.email_enviado_em)}` : i.email_erro ? <span className="text-destructive">{i.email_erro}</span> : i.participante.email ? "Não enviado" : "Sem e-mail"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <a href={`/inscricoes/${i.id}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>PDF</a>
                      {configurado && i.participante.email && <BotaoEmailUm inscricaoId={i.id} />}
                      <BotaoApagar acao={removerInscricao.bind(null, i.id, id)} confirmacao={`Remover ${i.participante.nome} deste evento?`} rotulo="Remover" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {inscricoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">Ninguém inscrito ainda.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
