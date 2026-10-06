# Evento por empresa, CSV do evento, PDF completo e importação no celular — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o CRM em empresa → evento → participantes, com CSV do evento, credencial em PDF mais completa e importação de planilha que não derruba a página no celular.

**Architecture:** O participante passa a pertencer ao evento: a tabela `inscricoes` some e o que era dela (código do QR, check-in, e-mail) vira coluna de `participantes`. O evento ganha `empresa_id`. As rotas globais de participante saem; tudo de participante mora em `/eventos/[id]/…`. CSV e textos do PDF saem de funções puras em `src/lib/`, testadas sem banco.

**Tech Stack:** Next.js 16.3 (App Router, Server Actions), React 19, Supabase (PostgREST via `@supabase/supabase-js`, chave service_role), pdf-lib, SheetJS (`xlsx`), zod 4, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-evento-por-empresa-design.md`

## Como este plano foi verificado

Todo o código abaixo foi **executado antes de entrar no plano**, numa cópia descartável do repositório, tarefa por tarefa, na ordem das tarefas: depois de cada uma, `tsc --noEmit`, `eslint .` e `vitest run` passaram (contagem de testes ao fim de cada tarefa: T1 51, T2 51, T3 53, T4 58, T5 63, T6 63), e no fim `next build` passou. O código foi extraído dos commits dessa cópia por script — não foi redigitado.

**Única exceção: o E2E da Tarefa 6 não foi executado**, porque roda contra o Supabase real, e o banco só tem o esquema novo depois das migrações das Tarefas 1 e 2 (ver "Banco compartilhado" abaixo). Ele compila (`tsc`), passa no lint e é listado pelo Playwright (`playwright test --list`: 2 testes, desktop e celular).

**Se algum número ou comportamento deste plano não bater com o que você medir, pare e pergunte** em vez de ajustar o número para fazer o teste passar.

## Global Constraints

- Idioma de código, comentários, mensagens de tela e commits: português do Brasil, no estilo do código vizinho.
- Rodapé do PDF, texto exato: `© <ano do evento> <Empresa cliente> · Organização VM Events. Todos os direitos reservados.`
- Tipos de participante **não mudam**: Palestrante, VIP, Autoridade, Convidado.
- CSV: separador `;`, quebra `\r\n`, UTF-8 com BOM; colunas na ordem `empresa; evento; tipo_evento; data_evento; nome; documento; data_nascimento; email; telefone; empresa_participante; tipo; compareceu; chegada`; `compareceu` = `Sim`/`Não`; `chegada` = `dd/mm/aaaa hh:mm` em `America/Sao_Paulo`.
- CPF é único **dentro do evento** (`unique (evento_id, documento)`); `codigo` é único no banco inteiro.
- O repositório é público: nenhum dado real de participante em teste, fixture, issue, PR ou commit.
- Envio de e-mail continua desligado (decisão do autor); só se adapta à tabela nova.
- Comandos: a saída do Bash passa por um hook que a corrompe. Rode testes e build pelo PowerShell, chamando o binário direto: `& .\node_modules\.bin\vitest.cmd run`, `& .\node_modules\.bin\tsc.cmd --noEmit`, `& .\node_modules\.bin\eslint.cmd .`, `& .\node_modules\.bin\next.cmd build`.

## Banco compartilhado — ler antes da Tarefa 1

Há **um** projeto Supabase (`crm`, id `ybqlpcgjmguhecezslmj`), usado pelo `next dev` local **e** pela produção (`main`, https://vmevents.vercel.app). Em 2026-10-06 ele tinha 1 empresa, 0 eventos, 0 participantes, 0 inscrições.

- A migração da Tarefa 1 (`eventos.empresa_id not null`) é aditiva, mas a partir dela **criar evento em produção falha** até a PR ser mesclada (o formulário de produção não manda empresa).
- A migração da Tarefa 2 **apaga** as tabelas `participantes` e `inscricoes`. A partir dela, as telas de participante, inscrição e check-in **de produção quebram** até a PR ser mesclada.
- Aplique cada migração com a ferramenta MCP `apply_migration` do Supabase, no projeto `ybqlpcgjmguhecezslmj` e em nenhum outro (a conta tem também o `ecommerce` — nunca tocar), **só com autorização do autor registrada no issue guarda-chuva**. Sem essa autorização, pare a fila e pergunte.
- Antes de aplicar, confira de novo que não há dado: `select (select count(*) from eventos) eventos, (select count(*) from participantes) participantes, (select count(*) from inscricoes) inscricoes;`. Se algum número não for 0, **pare e pergunte**.

## Review Focus

1. **Arquivo escolhido no Android que deixa de ser legível** (WhatsApp, Drive): a tela mostra "Não consegui abrir o arquivo. Escolha de novo." ou "Falha ao falar com o servidor. Tente de novo." e continua de pé — nunca "This page couldn't load". Não dá para reproduzir em teste; o autor confirma no próprio celular, no preview da PR. Coberto em código pela Tarefa 5 (cópia em memória + `try/catch`) e pelo teste que derruba o banco.
2. **Reimportar a planilha depois do check-in** mantém o código do QR (já impresso) e a presença, e atualiza os dados. Teste: E2E da Tarefa 6 ("Reimportar quem já fez check-in…").
3. **CSV aberto no Excel brasileiro** com acento, campo com `;` e célula que começa com `=`/`+`/`-`/`@`. Teste: `src/lib/csv.test.ts` (Tarefa 4). O autor abre um CSV real no Excel no preview.
4. **Empresa com evento não pode ser apagada** e a tela diz por quê. Teste: E2E da Tarefa 6 ("Empresa com evento não apaga").
5. **Mesmo CPF em dois eventos** são dois cadastros; no mesmo evento, é recusado com o nome de quem já tem. Teste: E2E da Tarefa 6.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `supabase/migrations/20261006000000_evento_por_empresa.sql` | `eventos.empresa_id` | 1 |
| `supabase/migrations/20261006000001_participante_no_evento.sql` | `participantes` por evento; some `inscricoes` | 2 |
| `src/app/empresas/[id]/page.tsx` | empresa + eventos dela + "Novo evento" | 1 |
| `src/app/eventos/formulario.tsx`, `novo/page.tsx`, `[id]/editar/page.tsx` | evento com empresa obrigatória | 1 |
| `src/app/eventos/[id]/participantes/**` | cadastrar, editar, remover participante do evento | 2 |
| `src/app/credenciais/[id]/pdf/route.ts` | PDF de um participante (antes `/inscricoes/[id]/pdf`) | 2 |
| `src/lib/busca.ts` | busca manual do check-in | 2 |
| `src/lib/pdf.ts` | `textosCredencial` (puro) + desenho | 3 |
| `src/lib/csv.ts`, `src/app/eventos/[id]/csv/route.ts` | CSV do evento | 4 |
| `src/app/eventos/[id]/importar/**`, `src/app/modelo-planilha/route.ts` | importação dentro do evento | 5 |
| `e2e/fluxo.spec.ts` | fluxo inteiro no navegador | 6 |

Saem: `src/app/participantes/**`, `src/app/eventos/[id]/inscrever/`, `src/app/inscricoes/`.

## Verificação no navegador (Tarefas 1, 2, 4 e 5)

São telas existentes ganhando campo, botão ou rota, reaproveitando os componentes que já estão no projeto (`Card`, `Table`, `Campo`, `Selecao`, `buttonVariants`) — sem redesenho. Depois de implementar, com `next dev` rodando e as migrações aplicadas, abra as telas tocadas no Playwright MCP em **1440 e 390 de largura**, tire **screenshot real** (`browser_take_screenshot`, não só snapshot ARIA), olhe `browser_console_messages` e clique nos botões novos. O perfil do Playwright MCP abre no tema escuro: confira também o claro.

---

### Tarefa 1: O evento pertence a uma empresa

O evento ganha `empresa_id` obrigatório. A tela da empresa passa a listar os eventos dela e a criar evento com a empresa já escolhida. Listas de empresas e de eventos mostram a ligação.

**Files:**
- Modify: `src/app/empresas/[id]/page.tsx`
- Modify: `src/app/empresas/page.tsx`
- Modify: `src/app/eventos/[id]/editar/page.tsx`
- Modify: `src/app/eventos/formulario.tsx`
- Modify: `src/app/eventos/novo/page.tsx`
- Modify: `src/app/eventos/page.tsx`
- Modify: `src/lib/dominio.test.ts`
- Modify: `src/lib/dominio.ts`
- Create: `supabase/migrations/20261006000000_evento_por_empresa.sql`

**Interfaces:**
- Consumes: `listarEmpresas()` de `src/lib/busca.ts` (já existe: `Promise<{ id: string; nome: string }[]>`).
- Produces: `eventoSchema` com `empresa_id: z.uuid({ message: "Escolha a empresa" })`; `FormularioEvento({ titulo, evento?, empresas, empresaPadrao? })` e o tipo `EventoEditavel = { id; nome; tipo; data; empresa_id }`; rota `/eventos/novo?empresa=<id>`; coluna `eventos.empresa_id` (`not null`, `on delete restrict`).

- [ ] **Step 1: Escrever o teste que falha**

Editar `src/lib/dominio.test.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/dominio.test.ts b/src/lib/dominio.test.ts
index 100441b..1c6a9cf 100644
--- a/src/lib/dominio.test.ts
+++ b/src/lib/dominio.test.ts
@@ -69,8 +69,16 @@ describe("ehUuid", () => {
 });
 
 describe("eventoSchema", () => {
+  const empresa_id = "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f";
+
   it("exige data real", () => {
-    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "2027-01-15" }).success).toBe(true);
-    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "" }).success).toBe(false);
+    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "2027-01-15", empresa_id }).success).toBe(true);
+    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "", empresa_id }).success).toBe(false);
+  });
+
+  it("exige a empresa", () => {
+    const r = eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "2027-01-15", empresa_id: "" });
+    expect(r.success).toBe(false);
+    expect(r.error!.issues.map((i) => i.message)).toEqual(["Escolha a empresa"]);
   });
 });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/dominio.test.ts`
Expected: FAIL em `eventoSchema > exige a empresa` — `expected true to be false` (o schema ainda ignora `empresa_id`).

- [ ] **Step 3: Implementar**

Reescrever `src/app/empresas/[id]/page.tsx` inteiro:

```tsx
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
```

Editar `src/app/empresas/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/empresas/page.tsx b/src/app/empresas/page.tsx
index b9eda8f..aec78a2 100644
--- a/src/app/empresas/page.tsx
+++ b/src/app/empresas/page.tsx
@@ -10,19 +10,19 @@ import { apagarEmpresa } from "./actions";
 
 export default async function Empresas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
   const { q = "" } = await searchParams;
-  let consulta = db().from("empresas").select("id, nome, participantes(count)").order("nome");
+  let consulta = db().from("empresas").select("id, nome, eventos(count)").order("nome");
   const termo = limparTermo(q);
   if (termo) consulta = consulta.ilike("nome", `%${termo}%`);
   const { data, error } = await consulta;
   if (error) throw new Error(error.message);
-  const empresas = data as unknown as { id: string; nome: string; participantes: { count: number }[] }[];
+  const empresas = data as unknown as { id: string; nome: string; eventos: { count: number }[] }[];
 
   return (
     <section className="grid gap-4">
       <div className="flex flex-wrap items-center justify-between gap-3">
         <div>
           <h1 className="text-2xl font-semibold">Empresas</h1>
-          <p className="text-sm text-muted-foreground">Empresas cadastradas e quantos participantes cada uma tem.</p>
+          <p className="text-sm text-muted-foreground">Empresas cadastradas e quantos eventos cada uma tem.</p>
         </div>
         <Link href="/empresas/novo" className={buttonVariants()}>Nova empresa</Link>
       </div>
@@ -36,7 +36,7 @@ export default async function Empresas({ searchParams }: { searchParams: Promise
             <TableHeader>
               <TableRow>
                 <TableHead>Nome</TableHead>
-                <TableHead className="text-right">Participantes</TableHead>
+                <TableHead className="text-right">Eventos</TableHead>
                 <TableHead />
               </TableRow>
             </TableHeader>
@@ -46,7 +46,7 @@ export default async function Empresas({ searchParams }: { searchParams: Promise
                   <TableCell>
                     <Link href={`/empresas/${e.id}`} className="hover:underline">{e.nome}</Link>
                   </TableCell>
-                  <TableCell className="text-right tabular-nums">{e.participantes[0]?.count ?? 0}</TableCell>
+                  <TableCell className="text-right tabular-nums">{e.eventos[0]?.count ?? 0}</TableCell>
                   <TableCell className="text-right">
                     <BotaoApagar acao={apagarEmpresa.bind(null, e.id)} confirmacao={`Apagar a empresa ${e.nome}?`} />
                   </TableCell>
```

Editar `src/app/eventos/[id]/editar/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/[id]/editar/page.tsx b/src/app/eventos/[id]/editar/page.tsx
index 99f12a1..7d9bbf1 100644
--- a/src/app/eventos/[id]/editar/page.tsx
+++ b/src/app/eventos/[id]/editar/page.tsx
@@ -1,12 +1,16 @@
 import { ehUuid } from "@/lib/dominio";
 import { notFound } from "next/navigation";
 import { db } from "@/lib/supabase";
+import { listarEmpresas } from "@/lib/busca";
 import { FormularioEvento } from "../../formulario";
 
 export default async function EditarEvento({ params }: { params: Promise<{ id: string }> }) {
   const { id } = await params;
   if (!ehUuid(id)) notFound();
-  const { data } = await db().from("eventos").select("id, nome, tipo, data").eq("id", id).maybeSingle();
+  const [{ data }, empresas] = await Promise.all([
+    db().from("eventos").select("id, nome, tipo, data, empresa_id").eq("id", id).maybeSingle(),
+    listarEmpresas(),
+  ]);
   if (!data) notFound();
-  return <FormularioEvento titulo="Editar evento" evento={data} />;
+  return <FormularioEvento titulo="Editar evento" evento={data} empresas={empresas} />;
 }
```

Editar `src/app/eventos/formulario.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/formulario.tsx b/src/app/eventos/formulario.tsx
index a2465d0..3ffc814 100644
--- a/src/app/eventos/formulario.tsx
+++ b/src/app/eventos/formulario.tsx
@@ -8,12 +8,25 @@ import { estadoInicial } from "@/lib/acao";
 import { TIPOS_EVENTO } from "@/lib/dominio";
 import { salvarEvento } from "./actions";
 
-export function FormularioEvento({ titulo, evento }: { titulo: string; evento?: { id: string; nome: string; tipo: string; data: string } }) {
+export type EventoEditavel = { id: string; nome: string; tipo: string; data: string; empresa_id: string };
+
+export function FormularioEvento({
+  titulo,
+  evento,
+  empresas,
+  empresaPadrao,
+}: {
+  titulo: string;
+  evento?: EventoEditavel;
+  empresas: { id: string; nome: string }[];
+  empresaPadrao?: string;
+}) {
   const [estado, acao, pendente] = useActionState(salvarEvento, estadoInicial);
   const e = estado.erros ?? {};
   const nome = estado.valores?.nome ?? evento?.nome;
   const tipo = estado.valores?.tipo ?? evento?.tipo ?? "palestra";
   const data = estado.valores?.data ?? evento?.data;
+  const empresa = estado.valores?.empresa_id ?? evento?.empresa_id ?? empresaPadrao ?? "";
   return (
     <form action={acao}>
       <Card className="max-w-2xl">
@@ -22,6 +35,18 @@ export function FormularioEvento({ titulo, evento }: { titulo: string; evento?:
         </CardHeader>
         <CardContent className="grid gap-4 md:grid-cols-2">
           {evento && <input type="hidden" name="id" value={evento.id} />}
+          <div className="md:col-span-2">
+            <Selecao
+              key={`empresa_id-${empresa}`}
+              nome="empresa_id"
+              rotulo="Empresa"
+              vazio="Escolha a empresa"
+              opcoes={Object.fromEntries(empresas.map((x) => [x.id, x.nome]))}
+              defaultValue={empresa}
+              erros={e.empresa_id}
+              required
+            />
+          </div>
           <div className="md:col-span-2">
             <Campo key={`nome-${nome}`} nome="nome" rotulo="Nome do evento" defaultValue={nome} erros={e.nome} required />
           </div>
```

Reescrever `src/app/eventos/novo/page.tsx` inteiro:

```tsx
import { listarEmpresas } from "@/lib/busca";
import { FormularioEvento } from "../formulario";

// Vindo da tela da empresa, chega com ?empresa=<id> e o campo já vem escolhido.
export default async function NovoEvento({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams;
  return <FormularioEvento titulo="Novo evento" empresas={await listarEmpresas()} empresaPadrao={empresa} />;
}
```

Editar `src/app/eventos/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/page.tsx b/src/app/eventos/page.tsx
index 1d7e47c..e7c8107 100644
--- a/src/app/eventos/page.tsx
+++ b/src/app/eventos/page.tsx
@@ -7,9 +7,9 @@ import { db } from "@/lib/supabase";
 import { formatarData, TIPOS_EVENTO, type TipoEvento } from "@/lib/dominio";
 
 export default async function Eventos() {
-  const { data, error } = await db().from("eventos").select("id, nome, tipo, data, inscricoes(count)").order("data", { ascending: false });
+  const { data, error } = await db().from("eventos").select("id, nome, tipo, data, empresa:empresas(nome), inscricoes(count)").order("data", { ascending: false });
   if (error) throw new Error(error.message);
-  const eventos = data as unknown as { id: string; nome: string; tipo: TipoEvento; data: string; inscricoes: { count: number }[] }[];
+  const eventos = data as unknown as { id: string; nome: string; tipo: TipoEvento; data: string; empresa: { nome: string }; inscricoes: { count: number }[] }[];
 
   return (
     <section className="grid gap-4">
@@ -27,6 +27,7 @@ export default async function Eventos() {
               <TableRow>
                 <TableHead>Data</TableHead>
                 <TableHead>Nome</TableHead>
+                <TableHead>Empresa</TableHead>
                 <TableHead>Tipo</TableHead>
                 <TableHead className="text-right">Inscritos</TableHead>
               </TableRow>
@@ -38,13 +39,14 @@ export default async function Eventos() {
                   <TableCell>
                     <Link href={`/eventos/${e.id}`} className="hover:underline">{e.nome}</Link>
                   </TableCell>
+                  <TableCell>{e.empresa.nome}</TableCell>
                   <TableCell><Badge variant="secondary">{TIPOS_EVENTO[e.tipo]}</Badge></TableCell>
                   <TableCell className="text-right tabular-nums">{e.inscricoes[0]?.count ?? 0}</TableCell>
                 </TableRow>
               ))}
               {eventos.length === 0 && (
                 <TableRow>
-                  <TableCell colSpan={4} className="text-muted-foreground">Nenhum evento cadastrado.</TableCell>
+                  <TableCell colSpan={5} className="text-muted-foreground">Nenhum evento cadastrado.</TableCell>
                 </TableRow>
               )}
             </TableBody>
```

Editar `src/lib/dominio.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/dominio.ts b/src/lib/dominio.ts
index 2207930..f622d98 100644
--- a/src/lib/dominio.ts
+++ b/src/lib/dominio.ts
@@ -75,6 +75,7 @@ export const eventoSchema = z.object({
   nome: z.string().trim().min(1, "Nome obrigatório"),
   tipo: z.enum(Object.keys(TIPOS_EVENTO) as [TipoEvento, ...TipoEvento[]], { message: "Tipo inválido" }),
   data: z.string().refine(dataIsoValida, "Data inválida"),
+  empresa_id: z.uuid({ message: "Escolha a empresa" }),
 });
 export type EventoInput = z.output<typeof eventoSchema>;
 
```

Criar `supabase/migrations/20261006000000_evento_por_empresa.sql`:

```sql
-- Todo evento pertence a uma empresa. Em 2026-10-06 produção tinha 0 eventos, por isso o
-- `not null` entra direto, sem preencher linhas antigas.
alter table eventos add column empresa_id uuid not null references empresas (id) on delete restrict;
create index eventos_empresa on eventos (empresa_id);
```

- [ ] **Step 4: Aplicar a migração**

Com a autorização registrada (ver "Banco compartilhado"), confira a contagem e aplique `supabase/migrations/20261006000000_evento_por_empresa.sql` pelo `apply_migration` (nome `evento_por_empresa`) no projeto `ybqlpcgjmguhecezslmj`. Confira com `select column_name, is_nullable from information_schema.columns where table_name = 'eventos' and column_name = 'empresa_id';` → `empresa_id | NO`.

- [ ] **Step 5: Rodar tudo**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\eslint.cmd .; & .\node_modules\.bin\vitest.cmd run`
Expected: tsc e eslint sem saída; `Tests  51 passed (51)`.

- [ ] **Step 6: Ver no navegador**

`next dev`, então: `/empresas` → empresa → card "Eventos de …" com "Novo evento" → formulário com a empresa já escolhida → salvar cai em `/eventos/<id>`. `/eventos` mostra a coluna Empresa. Tentar salvar evento sem empresa mostra "Escolha a empresa". Screenshots 1440 e 390 (ver "Verificação no navegador").

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261006000000_evento_por_empresa.sql src/lib/dominio.ts src/lib/dominio.test.ts src/app/eventos src/app/empresas
git commit -m "Evento pertence a uma empresa"
```

---

### Tarefa 2: O participante pertence ao evento

A tabela `inscricoes` some; `participantes` é recriada com `evento_id`, o código do QR, o check-in e o status do e-mail. Todo o cadastro de participante passa para dentro do evento; as rotas globais de participante e a tela "Inscrever" saem. Check-in, ZIP, PDF e e-mail passam a ler `participantes`. O menu fica Empresas, Eventos, Check-in.

A importação de planilha **fica fora do ar entre esta tarefa e a Tarefa 5**: o código antigo gravava em `inscricoes` e é apagado aqui; a Tarefa 5 a recria dentro do evento. É esperado — as duas saem na mesma PR.

**Files:**
- Modify: `src/app/checkin/actions.ts`
- Modify: `src/app/checkin/leitor.tsx`
- Move: `src/app/credenciais/[id]/pdf/route.ts` (de `src/app/inscricoes/[id]/pdf/route.ts`)
- Modify: `src/app/eventos/[id]/email-actions.ts`
- Modify: `src/app/eventos/[id]/envio-email.tsx`
- Delete: `src/app/eventos/[id]/inscrever/page.tsx`
- Modify: `src/app/eventos/[id]/page.tsx`
- Create: `src/app/eventos/[id]/participantes/[pid]/page.tsx`
- Create: `src/app/eventos/[id]/participantes/actions.ts`
- Move: `src/app/eventos/[id]/participantes/formulario.tsx` (de `src/app/participantes/formulario.tsx`)
- Create: `src/app/eventos/[id]/participantes/novo/page.tsx`
- Create: `src/app/eventos/[id]/participantes/page.tsx`
- Modify: `src/app/eventos/actions.ts`
- Modify: `src/app/eventos/page.tsx`
- Delete: `src/app/participantes/[id]/page.tsx`
- Delete: `src/app/participantes/actions.ts`
- Delete: `src/app/participantes/importar/actions.ts`
- Delete: `src/app/participantes/importar/importador.tsx`
- Delete: `src/app/participantes/importar/page.tsx`
- Delete: `src/app/participantes/modelo/route.ts`
- Delete: `src/app/participantes/novo/page.tsx`
- Delete: `src/app/participantes/page.tsx`
- Modify: `src/components/menu-lateral.tsx`
- Modify: `src/lib/busca.ts`
- Modify: `src/lib/credencial.ts`
- Modify: `src/lib/dominio.test.ts`
- Modify: `src/lib/dominio.ts`
- Modify: `src/lib/navegacao.test.ts`
- Modify: `src/lib/navegacao.ts`
- Modify: `src/lib/planilha.ts`
- Create: `supabase/migrations/20261006000001_participante_no_evento.sql`

**Interfaces:**
- Consumes: `eventos.empresa_id` (Tarefa 1).
- Produces:
  - Tabela `participantes(id, evento_id, nome, nome_busca, documento, data_nascimento, email, telefone, empresa text, tipo, codigo unique, checkin_em, email_enviado_em, email_erro, created_at, unique(evento_id, documento))`.
  - `participanteSchema` ganha `empresa` (texto livre opcional, espaços colapsados); `DadosImportacao = ParticipanteInput` (a empresa já vem no schema).
  - `Credencial = DadosCredencial & { participanteId: string; email: string | null }` — antes era `inscricaoId`.
  - `salvarParticipante(_anterior, form)` e `apagarParticipante(id, eventoId)` em `src/app/eventos/[id]/participantes/actions.ts`; o form manda `evento_id` escondido.
  - `checkinPorParticipante(participanteId, eventoId)` (antes `checkinPorInscricao`); `Inscrito.participanteId` (antes `inscricaoId`).
  - `buscarParticipantes({ termo, eventoId, limite? })` em `src/lib/busca.ts`, só para o check-in.
  - `enviarEmailParticipante(participanteId)` (antes `enviarEmailInscricao`); `BotaoEmailUm({ participanteId })`.
  - Rota `GET /credenciais/<participanteId>/pdf`.

- [ ] **Step 1: Escrever os testes que falham**

Editar `src/lib/dominio.test.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/dominio.test.ts b/src/lib/dominio.test.ts
index 1c6a9cf..f92750a 100644
--- a/src/lib/dominio.test.ts
+++ b/src/lib/dominio.test.ts
@@ -26,6 +26,7 @@ describe("participanteSchema", () => {
       data_nascimento: "",
       email: "",
       telefone: " ",
+      empresa: "  Acme   Ltda ",
       tipo: "vip",
     });
     expect(r).toEqual({
@@ -34,6 +35,7 @@ describe("participanteSchema", () => {
       data_nascimento: null,
       email: null,
       telefone: null,
+      empresa: "Acme Ltda",
       tipo: "vip",
     });
   });
@@ -44,6 +46,7 @@ describe("participanteSchema", () => {
       data_nascimento: "1990-13-01",
       email: "nao-e-email",
       telefone: "",
+      empresa: "",
       tipo: "imprensa",
     });
     expect(r.success).toBe(false);
```

Editar `src/lib/navegacao.test.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/navegacao.test.ts b/src/lib/navegacao.test.ts
index 06984cb..dd43ef3 100644
--- a/src/lib/navegacao.test.ts
+++ b/src/lib/navegacao.test.ts
@@ -4,12 +4,12 @@ import { itemAtivo, trilha } from "./navegacao";
 describe("itemAtivo", () => {
   it("acende o item da rota e das sub-rotas", () => {
     expect(itemAtivo("/eventos")).toBe("/eventos");
-    expect(itemAtivo("/eventos/123/inscrever")).toBe("/eventos");
+    expect(itemAtivo("/eventos/123/participantes/novo")).toBe("/eventos");
+    expect(itemAtivo("/empresas/123")).toBe("/empresas");
   });
 
-  it("prefere o prefixo mais longo", () => {
-    expect(itemAtivo("/participantes/importar")).toBe("/participantes/importar");
-    expect(itemAtivo("/participantes/novo")).toBe("/participantes");
+  it("rota que saiu do menu não acende nada", () => {
+    expect(itemAtivo("/participantes")).toBeUndefined();
   });
 
   it("não confunde prefixo de texto com rota", () => {
@@ -20,10 +20,11 @@ describe("itemAtivo", () => {
 
 describe("trilha", () => {
   it("nomeia os segmentos conhecidos e chama o id de Detalhe", () => {
-    expect(trilha("/eventos/4f1c/inscrever")).toEqual([
+    expect(trilha("/eventos/4f1c/participantes/novo")).toEqual([
       { href: "/eventos", texto: "Eventos" },
       { href: "/eventos/4f1c", texto: "Detalhe" },
-      { href: "/eventos/4f1c/inscrever", texto: "Inscrever" },
+      { href: "/eventos/4f1c/participantes", texto: "Participantes" },
+      { href: "/eventos/4f1c/participantes/novo", texto: "Novo" },
     ]);
   });
 
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/dominio.test.ts src/lib/navegacao.test.ts`
Expected: FAIL em `participanteSchema > normaliza…` (falta `empresa: "Acme Ltda"` no resultado — o schema ainda descarta o campo) e em `itemAtivo > rota que saiu do menu…` (`expected '/participantes' to be undefined`).

- [ ] **Step 3: Implementar**

Reescrever `src/app/checkin/actions.ts` inteiro:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { buscarParticipantes } from "@/lib/busca";
import { ehUuid, TIPOS_PARTICIPANTE, type TipoParticipante } from "@/lib/dominio";

export type ResultadoCheckin =
  | { status: "ok" | "repetido"; nome: string; tipo: string; empresa: string | null; evento: string; checkinEm: string }
  | { status: "outro_evento"; nome: string; evento: string }
  | { status: "desconhecido" };

type Linha = {
  id: string;
  evento_id: string;
  checkin_em: string | null;
  nome: string;
  tipo: TipoParticipante;
  empresa: string | null;
  evento: { nome: string };
};

const CAMPOS = "id, evento_id, checkin_em, nome, tipo, empresa, evento:eventos(nome)";

export async function checkinPorCodigo(codigo: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const limpo = codigo.trim();
  return limpo ? registrar("codigo", limpo, eventoId) : { status: "desconhecido" };
}

export async function checkinPorParticipante(participanteId: string, eventoId: string | null): Promise<ResultadoCheckin> {
  return ehUuid(participanteId) ? registrar("id", participanteId, eventoId) : { status: "desconhecido" };
}

async function registrar(coluna: "codigo" | "id", valor: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const { data, error } = await db().from("participantes").select(CAMPOS).eq(coluna, valor).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { status: "desconhecido" };
  const l = data as unknown as Linha;
  if (eventoId && l.evento_id !== eventoId) return { status: "outro_evento", nome: l.nome, evento: l.evento.nome };

  const base = { nome: l.nome, tipo: TIPOS_PARTICIPANTE[l.tipo], empresa: l.empresa, evento: l.evento.nome };
  // Um único UPDATE condicionado a checkin_em vazio: dois celulares no mesmo QR dão um "ok" e um "repetido".
  const { data: marcadas, error: e2 } = await db()
    .from("participantes")
    .update({ checkin_em: new Date().toISOString() })
    .eq("id", l.id)
    .is("checkin_em", null)
    .select("checkin_em");
  if (e2) throw new Error(e2.message);
  revalidatePath(`/eventos/${l.evento_id}`);
  if (marcadas.length) return { status: "ok", ...base, checkinEm: marcadas[0].checkin_em as string };

  const { data: atual } = await db().from("participantes").select("checkin_em").eq("id", l.id).single();
  return { status: "repetido", ...base, checkinEm: (atual?.checkin_em as string | undefined) ?? l.checkin_em ?? "" };
}

export type Inscrito = { participanteId: string; nome: string; documento: string; empresa: string | null; evento: string; checkinEm: string | null };

// Busca manual: para quem chega sem QR legível.
export async function buscarInscritos(termo: string, eventoId: string | null): Promise<Inscrito[]> {
  const encontrados = await buscarParticipantes({ termo, eventoId });
  return encontrados.map((p) => ({ participanteId: p.id, nome: p.nome, documento: p.documento, empresa: p.empresa, evento: p.evento.nome, checkinEm: p.checkin_em }));
}
```

Editar `src/app/checkin/leitor.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/checkin/leitor.tsx b/src/app/checkin/leitor.tsx
index 00eb6ad..2ac5e64 100644
--- a/src/app/checkin/leitor.tsx
+++ b/src/app/checkin/leitor.tsx
@@ -7,7 +7,7 @@ import { ArrowLeft } from "lucide-react";
 import { Button, buttonVariants } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
-import { buscarInscritos, checkinPorCodigo, checkinPorInscricao, type Inscrito, type ResultadoCheckin } from "./actions";
+import { buscarInscritos, checkinPorCodigo, checkinPorParticipante, type Inscrito, type ResultadoCheckin } from "./actions";
 
 // Verde/âmbar/vermelho distintos; contraste texto/fundo medido ≥ 4,5:1 nos dois temas
 // (tabela completa, par a par, no IMPLEMENTACAO.md da issue #21).
@@ -168,7 +168,7 @@ export function Leitor({ eventos, padrao }: { eventos: { id: string; rotulo: str
           </form>
           <ul className="grid gap-2">
             {inscritos.map((i) => (
-              <li key={i.inscricaoId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
+              <li key={i.participanteId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                 <span>
                   <span className="block font-medium">{i.nome}</span>
                   <span className="block text-xs text-muted-foreground">
@@ -181,7 +181,7 @@ export function Leitor({ eventos, padrao }: { eventos: { id: string; rotulo: str
                   disabled={pendente}
                   onClick={() =>
                     iniciar(async () => {
-                      setResultado(await checkinPorInscricao(i.inscricaoId, eventoId || null));
+                      setResultado(await checkinPorParticipante(i.participanteId, eventoId || null));
                       setInscritos([]);
                     })
                   }
```

Mover `src/app/inscricoes/[id]/pdf/route.ts` para `src/app/credenciais/[id]/pdf/route.ts` (`git mv`) e deixar o conteúdo assim:

```ts
import { carregarCredenciais } from "@/lib/credencial";
import { ehUuid } from "@/lib/dominio";
import { gerarCredencialPdf } from "@/lib/pdf";
import { nomeArquivo } from "@/lib/zip";

// PDF de um participante; o id é o do participante.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Participante não encontrado", { status: 404 });
  const [c] = await carregarCredenciais({ ids: [id] });
  if (!c) return new Response("Participante não encontrado", { status: 404 });
  return new Response(Buffer.from(await gerarCredencialPdf(c)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo(c.nome)}.pdf"`,
    },
  });
}
```

Editar `src/app/eventos/[id]/email-actions.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/[id]/email-actions.ts b/src/app/eventos/[id]/email-actions.ts
index 757e961..c4ab5dd 100644
--- a/src/app/eventos/[id]/email-actions.ts
+++ b/src/app/eventos/[id]/email-actions.ts
@@ -9,18 +9,18 @@ import type { EstadoAcao } from "@/lib/acao";
 
 const LOTE = 10;
 
-// Cota esgotada não marca erro: a inscrição continua pendente e entra no lote de amanhã.
+// Cota esgotada não marca erro: o participante continua pendente e entra no lote de amanhã.
 async function enviarERegistrar(c: Credencial): Promise<ResultadoEnvio> {
   const r = await enviarCredencial(c, await gerarCredencialPdf(c));
-  if (r.ok) await db().from("inscricoes").update({ email_enviado_em: new Date().toISOString(), email_erro: null }).eq("id", c.inscricaoId);
-  else if (!r.cotaEsgotada) await db().from("inscricoes").update({ email_erro: r.erro }).eq("id", c.inscricaoId);
+  if (r.ok) await db().from("participantes").update({ email_enviado_em: new Date().toISOString(), email_erro: null }).eq("id", c.participanteId);
+  else if (!r.cotaEsgotada) await db().from("participantes").update({ email_erro: r.erro }).eq("id", c.participanteId);
   return r;
 }
 
-export async function enviarEmailInscricao(inscricaoId: string): Promise<EstadoAcao> {
+export async function enviarEmailParticipante(participanteId: string): Promise<EstadoAcao> {
   if (!emailConfigurado()) return { ok: false, mensagem: "Envio por e-mail não configurado" };
-  const [c] = await carregarCredenciais({ ids: [inscricaoId] });
-  if (!c) return { ok: false, mensagem: "Inscrição não encontrada" };
+  const [c] = await carregarCredenciais({ ids: [participanteId] });
+  if (!c) return { ok: false, mensagem: "Participante não encontrado" };
   const r = await enviarERegistrar(c);
   revalidatePath("/eventos/[id]", "page");
   return r.ok ? { ok: true, mensagem: `E-mail enviado para ${c.email}` } : { ok: false, mensagem: r.erro };
@@ -33,7 +33,7 @@ export type ResultadoLote = { enviados: number; falhas: number; restantes: numbe
 export async function enviarLoteEmail(eventoId: string): Promise<ResultadoLote> {
   if (!emailConfigurado()) return { enviados: 0, falhas: 0, restantes: 0, cotaEsgotada: false };
   const pendentes = () =>
-    db().from("inscricoes").select("id", { count: "exact" }).eq("evento_id", eventoId).is("email_enviado_em", null).is("email_erro", null);
+    db().from("participantes").select("id", { count: "exact" }).eq("evento_id", eventoId).is("email_enviado_em", null).is("email_erro", null);
   const { data, error } = await pendentes().limit(LOTE);
   if (error) throw new Error(error.message);
   const credenciais = data.length ? await carregarCredenciais({ ids: data.map((d) => d.id as string) }) : [];
```

Editar `src/app/eventos/[id]/envio-email.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/[id]/envio-email.tsx b/src/app/eventos/[id]/envio-email.tsx
index cd4aeba..b17d676 100644
--- a/src/app/eventos/[id]/envio-email.tsx
+++ b/src/app/eventos/[id]/envio-email.tsx
@@ -3,7 +3,7 @@
 import { useState, useTransition } from "react";
 import { toast } from "sonner";
 import { Button } from "@/components/ui/button";
-import { enviarEmailInscricao, enviarLoteEmail } from "./email-actions";
+import { enviarEmailParticipante, enviarLoteEmail } from "./email-actions";
 
 export function EnvioEmail({ eventoId, configurado }: { eventoId: string; configurado: boolean }) {
   const [progresso, setProgresso] = useState("");
@@ -48,7 +48,7 @@ export function EnvioEmail({ eventoId, configurado }: { eventoId: string; config
   );
 }
 
-export function BotaoEmailUm({ inscricaoId }: { inscricaoId: string }) {
+export function BotaoEmailUm({ participanteId }: { participanteId: string }) {
   const [pendente, iniciar] = useTransition();
   return (
     <Button
@@ -58,7 +58,7 @@ export function BotaoEmailUm({ inscricaoId }: { inscricaoId: string }) {
       disabled={pendente}
       onClick={() =>
         iniciar(async () => {
-          const r = await enviarEmailInscricao(inscricaoId);
+          const r = await enviarEmailParticipante(participanteId);
           if (r.ok) toast.success(r.mensagem);
           else toast.error(r.mensagem);
         })
```

- Apagar `src/app/eventos/[id]/inscrever/page.tsx`.

Editar `src/app/eventos/[id]/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/[id]/page.tsx b/src/app/eventos/[id]/page.tsx
index e7195c0..9f5ab89 100644
--- a/src/app/eventos/[id]/page.tsx
+++ b/src/app/eventos/[id]/page.tsx
@@ -10,16 +10,20 @@ import { db } from "@/lib/supabase";
 import { emailConfigurado } from "@/lib/email";
 import { iniciais } from "@/lib/texto";
 import { ehUuid, formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "@/lib/dominio";
-import { apagarEvento, removerInscricao } from "../actions";
+import { apagarEvento } from "../actions";
+import { apagarParticipante } from "./participantes/actions";
 import { EnvioEmail, BotaoEmailUm } from "./envio-email";
 
-type Inscricao = {
+type Participante = {
   id: string;
+  nome: string;
+  email: string | null;
+  empresa: string | null;
+  tipo: TipoParticipante;
   codigo: string;
   checkin_em: string | null;
   email_enviado_em: string | null;
   email_erro: string | null;
-  participante: { nome: string; email: string | null; tipo: TipoParticipante; empresa: { nome: string } | null };
 };
 
 const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
@@ -28,22 +32,25 @@ export default async function Evento({ params }: { params: Promise<{ id: string
   const { id } = await params;
   if (!ehUuid(id)) notFound();
   const [{ data: evento }, { data, error }] = await Promise.all([
-    db().from("eventos").select("id, nome, tipo, data").eq("id", id).maybeSingle(),
+    db().from("eventos").select("id, nome, tipo, data, empresa:empresas(id, nome)").eq("id", id).maybeSingle(),
     db()
-      .from("inscricoes")
-      .select("id, codigo, checkin_em, email_enviado_em, email_erro, participante:participantes(nome, email, tipo, empresa:empresas(nome))")
-      .eq("evento_id", id),
+      .from("participantes")
+      .select("id, nome, email, empresa, tipo, codigo, checkin_em, email_enviado_em, email_erro")
+      .eq("evento_id", id)
+      .order("nome_busca"),
   ]);
   if (!evento) notFound();
   if (error) throw new Error(error.message);
-  const inscricoes = (data as unknown as Inscricao[]).sort((a, b) => a.participante.nome.localeCompare(b.participante.nome, "pt-BR"));
-  const presentes = inscricoes.filter((i) => i.checkin_em).length;
+  const empresa = evento.empresa as unknown as { id: string; nome: string };
+  const participantes = data as Participante[];
+  const presentes = participantes.filter((p) => p.checkin_em).length;
   const configurado = emailConfigurado();
 
   return (
     <section className="grid gap-5">
       <div className="flex flex-wrap items-start justify-between gap-3">
         <div>
+          <Link href={`/empresas/${empresa.id}`} className="text-sm font-medium text-muted-foreground hover:underline">{empresa.nome}</Link>
           <h1 className="text-2xl font-semibold">{evento.nome}</h1>
           <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
             <Badge variant="secondary">{TIPOS_EVENTO[evento.tipo as TipoEvento]}</Badge>
@@ -51,32 +58,32 @@ export default async function Evento({ params }: { params: Promise<{ id: string
           </p>
         </div>
         <div className="flex flex-wrap gap-2">
-          <Link href={`/eventos/${id}/inscrever`} className={buttonVariants()}>Inscrever participantes</Link>
-          <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
+          <Link href={`/eventos/${id}/participantes/novo`} className={buttonVariants()}>Adicionar participante</Link>
           <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
-          <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todas as inscrições?`} rotulo="Apagar evento" />
+          <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
+          <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todos os participantes dele?`} rotulo="Apagar evento" />
         </div>
       </div>
 
       <div className="grid gap-3 sm:grid-cols-3">
         <Card size="sm">
           <CardContent className="grid gap-1">
-            <p className="text-sm text-muted-foreground">Inscritos</p>
-            <p className="text-2xl font-semibold tabular-nums">{inscricoes.length}</p>
+            <p className="text-sm text-muted-foreground">Participantes</p>
+            <p className="text-2xl font-semibold tabular-nums">{participantes.length}</p>
           </CardContent>
         </Card>
         <Card size="sm">
           <CardContent className="grid gap-1">
             <p className="text-sm text-muted-foreground">Presentes</p>
-            <p className="text-2xl font-semibold tabular-nums" aria-label="Presentes sobre inscritos">
-              {presentes}/{inscricoes.length}
+            <p className="text-2xl font-semibold tabular-nums" aria-label="Presentes sobre participantes">
+              {presentes}/{participantes.length}
             </p>
           </CardContent>
         </Card>
         <Card size="sm">
           <CardContent className="grid gap-1">
             <p className="text-sm text-muted-foreground">Faltam</p>
-            <p className="text-2xl font-semibold tabular-nums">{inscricoes.length - presentes}</p>
+            <p className="text-2xl font-semibold tabular-nums">{participantes.length - presentes}</p>
           </CardContent>
         </Card>
       </div>
@@ -97,43 +104,43 @@ export default async function Evento({ params }: { params: Promise<{ id: string
               </TableRow>
             </TableHeader>
             <TableBody>
-              {inscricoes.map((i) => (
-                <TableRow key={i.id}>
+              {participantes.map((p) => (
+                <TableRow key={p.id}>
                   <TableCell>
                     <div className="flex items-center gap-3">
                       <Avatar size="sm">
-                        <AvatarFallback>{iniciais(i.participante.nome)}</AvatarFallback>
+                        <AvatarFallback>{iniciais(p.nome)}</AvatarFallback>
                       </Avatar>
                       <div className="grid">
-                        <span className="font-medium">{i.participante.nome}</span>
-                        {i.participante.empresa && <span className="text-xs text-muted-foreground">{i.participante.empresa.nome}</span>}
+                        <Link href={`/eventos/${id}/participantes/${p.id}`} className="font-medium hover:underline">{p.nome}</Link>
+                        {p.empresa && <span className="text-xs text-muted-foreground">{p.empresa}</span>}
                       </div>
                     </div>
                   </TableCell>
-                  <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[i.participante.tipo]}</Badge></TableCell>
-                  <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
+                  <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[p.tipo]}</Badge></TableCell>
+                  <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                   <TableCell>
-                    {i.checkin_em ? (
-                      <Badge className="bg-sucesso/10 text-sucesso">{hora(i.checkin_em)}</Badge>
+                    {p.checkin_em ? (
+                      <Badge className="bg-sucesso/10 text-sucesso">{hora(p.checkin_em)}</Badge>
                     ) : (
                       <Badge variant="outline">Pendente</Badge>
                     )}
                   </TableCell>
                   <TableCell className="text-xs">
-                    {i.email_enviado_em ? `Enviado ${hora(i.email_enviado_em)}` : i.email_erro ? <span className="text-destructive">{i.email_erro}</span> : i.participante.email ? "Não enviado" : "Sem e-mail"}
+                    {p.email_enviado_em ? `Enviado ${hora(p.email_enviado_em)}` : p.email_erro ? <span className="text-destructive">{p.email_erro}</span> : p.email ? "Não enviado" : "Sem e-mail"}
                   </TableCell>
                   <TableCell>
                     <div className="flex justify-end gap-2">
-                      <a href={`/inscricoes/${i.id}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>PDF</a>
-                      {configurado && i.participante.email && <BotaoEmailUm inscricaoId={i.id} />}
-                      <BotaoApagar acao={removerInscricao.bind(null, i.id, id)} confirmacao={`Remover ${i.participante.nome} deste evento?`} rotulo="Remover" />
+                      <a href={`/credenciais/${p.id}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>PDF</a>
+                      {configurado && p.email && <BotaoEmailUm participanteId={p.id} />}
+                      <BotaoApagar acao={apagarParticipante.bind(null, p.id, id)} confirmacao={`Remover ${p.nome} deste evento?`} rotulo="Remover" />
                     </div>
                   </TableCell>
                 </TableRow>
               ))}
-              {inscricoes.length === 0 && (
+              {participantes.length === 0 && (
                 <TableRow>
-                  <TableCell colSpan={6} className="text-muted-foreground">Ninguém inscrito ainda.</TableCell>
+                  <TableCell colSpan={6} className="text-muted-foreground">Nenhum participante ainda.</TableCell>
                 </TableRow>
               )}
             </TableBody>
```

Criar `src/app/eventos/[id]/participantes/[pid]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { ehUuid } from "@/lib/dominio";
import { db } from "@/lib/supabase";
import { FormularioParticipante, type ParticipanteEditavel } from "../formulario";

export default async function EditarParticipante({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  if (!ehUuid(id) || !ehUuid(pid)) notFound();
  const { data } = await db()
    .from("participantes")
    .select("id, nome, documento, data_nascimento, email, telefone, empresa, tipo")
    .eq("id", pid)
    .eq("evento_id", id)
    .maybeSingle();
  if (!data) notFound();
  return <FormularioParticipante titulo="Editar participante" eventoId={id} participante={data as ParticipanteEditavel} />;
}
```

Criar `src/app/eventos/[id]/participantes/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { ehUuid, participanteSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { gerarCodigo } from "@/lib/codigo";
import { normalizarBusca } from "@/lib/texto";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarParticipante(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const eventoId = valores.evento_id ?? "";
  if (!ehUuid(eventoId)) return { ok: false, mensagem: "Evento inválido", valores };
  const r = participanteSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const linha = { ...r.data, nome_busca: normalizarBusca(r.data.nome) };
  // Editar nunca troca o evento nem o código do QR, que pode já estar impresso.
  const { error } = valores.id
    ? await db().from("participantes").update(linha).eq("id", valores.id).eq("evento_id", eventoId)
    : await db().from("participantes").insert({ ...linha, evento_id: eventoId, codigo: gerarCodigo() });
  if (error) {
    if (error.code === "23505") {
      const { data: dono } = await db().from("participantes").select("nome").eq("evento_id", eventoId).eq("documento", r.data.documento).maybeSingle();
      const mensagem = `Documento já cadastrado neste evento para ${dono?.nome ?? "outro participante"}`;
      return { ok: false, mensagem, erros: { documento: [mensagem] }, valores };
    }
    return { ok: false, mensagem: mensagemErro(error), valores };
  }
  revalidatePath(`/eventos/${eventoId}`);
  redirect(`/eventos/${eventoId}`);
}

export async function apagarParticipante(id: string, eventoId: string): Promise<EstadoAcao> {
  const { error } = await db().from("participantes").delete().eq("id", id).eq("evento_id", eventoId);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath(`/eventos/${eventoId}`);
  return { ok: true, mensagem: "Participante removido" };
}
```

Mover `src/app/participantes/formulario.tsx` para `src/app/eventos/[id]/participantes/formulario.tsx` (`git mv`) e deixar o conteúdo assim:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { TIPOS_PARTICIPANTE } from "@/lib/dominio";
import { salvarParticipante } from "./actions";

export type ParticipanteEditavel = {
  id: string;
  nome: string;
  documento: string;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  tipo: string;
};

export function FormularioParticipante({ titulo, eventoId, participante }: { titulo: string; eventoId: string; participante?: ParticipanteEditavel }) {
  const [estado, acao, pendente] = useActionState(salvarParticipante, estadoInicial);
  const v = (campo: keyof ParticipanteEditavel) => estado.valores?.[campo] ?? participante?.[campo] ?? "";
  const e = estado.erros ?? {};
  return (
    <form action={acao}>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="evento_id" value={eventoId} />
          {participante && <input type="hidden" name="id" value={participante.id} />}
          <div className="md:col-span-2">
            <Campo key={`nome-${v("nome")}`} nome="nome" rotulo="Nome" defaultValue={v("nome")} erros={e.nome} required />
          </div>
          <Campo key={`documento-${v("documento")}`} nome="documento" rotulo="CPF ou documento" defaultValue={v("documento")} erros={e.documento} required inputMode="text" />
          <Campo key={`data_nascimento-${v("data_nascimento")}`} nome="data_nascimento" rotulo="Data de nascimento" type="date" defaultValue={v("data_nascimento")} erros={e.data_nascimento} />
          <Campo key={`email-${v("email")}`} nome="email" rotulo="E-mail" type="email" defaultValue={v("email")} erros={e.email} />
          <Campo key={`telefone-${v("telefone")}`} nome="telefone" rotulo="Telefone" type="tel" defaultValue={v("telefone")} erros={e.telefone} />
          <Campo key={`empresa-${v("empresa")}`} nome="empresa" rotulo="Empresa do participante" defaultValue={v("empresa")} erros={e.empresa} />
          <Selecao key={`tipo-${v("tipo") || "convidado"}`} nome="tipo" rotulo="Tipo" opcoes={TIPOS_PARTICIPANTE} defaultValue={v("tipo") || "convidado"} erros={e.tipo} />
          {!estado.ok && !estado.erros && <p className="text-sm text-destructive md:col-span-2">{estado.mensagem}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

Criar `src/app/eventos/[id]/participantes/novo/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { ehUuid } from "@/lib/dominio";
import { db } from "@/lib/supabase";
import { FormularioParticipante } from "../formulario";

export default async function NovoParticipante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data: evento } = await db().from("eventos").select("nome").eq("id", id).maybeSingle();
  if (!evento) notFound();
  return <FormularioParticipante titulo={`Novo participante em ${evento.nome}`} eventoId={id} />;
}
```

Criar `src/app/eventos/[id]/participantes/page.tsx`:

```tsx
import { redirect } from "next/navigation";

// O breadcrumb de /eventos/<id>/participantes/novo aponta para cá; a lista mora na tela do evento.
export default async function Participantes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/eventos/${id}`);
}
```

Reescrever `src/app/eventos/actions.ts` inteiro:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { eventoSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarEvento(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = eventoSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const { data, error } = valores.id
    ? await db().from("eventos").update(r.data).eq("id", valores.id).select("id").single()
    : await db().from("eventos").insert(r.data).select("id").single();
  if (error) return { ok: false, mensagem: mensagemErro(error), valores };
  revalidatePath("/eventos");
  redirect(`/eventos/${data.id}`);
}

export async function apagarEvento(id: string): Promise<EstadoAcao> {
  const { error } = await db().from("eventos").delete().eq("id", id);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath("/eventos");
  redirect("/eventos");
}
```

Editar `src/app/eventos/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/page.tsx b/src/app/eventos/page.tsx
index e7c8107..0268370 100644
--- a/src/app/eventos/page.tsx
+++ b/src/app/eventos/page.tsx
@@ -7,16 +7,16 @@ import { db } from "@/lib/supabase";
 import { formatarData, TIPOS_EVENTO, type TipoEvento } from "@/lib/dominio";
 
 export default async function Eventos() {
-  const { data, error } = await db().from("eventos").select("id, nome, tipo, data, empresa:empresas(nome), inscricoes(count)").order("data", { ascending: false });
+  const { data, error } = await db().from("eventos").select("id, nome, tipo, data, empresa:empresas(nome), participantes(count)").order("data", { ascending: false });
   if (error) throw new Error(error.message);
-  const eventos = data as unknown as { id: string; nome: string; tipo: TipoEvento; data: string; empresa: { nome: string }; inscricoes: { count: number }[] }[];
+  const eventos = data as unknown as { id: string; nome: string; tipo: TipoEvento; data: string; empresa: { nome: string }; participantes: { count: number }[] }[];
 
   return (
     <section className="grid gap-4">
       <div className="flex flex-wrap items-center justify-between gap-3">
         <div>
           <h1 className="text-2xl font-semibold">Eventos</h1>
-          <p className="text-sm text-muted-foreground">Eventos cadastrados e o total de inscritos em cada um.</p>
+          <p className="text-sm text-muted-foreground">Eventos cadastrados e o total de participantes em cada um.</p>
         </div>
         <Link href="/eventos/novo" className={buttonVariants()}>Novo evento</Link>
       </div>
@@ -29,7 +29,7 @@ export default async function Eventos() {
                 <TableHead>Nome</TableHead>
                 <TableHead>Empresa</TableHead>
                 <TableHead>Tipo</TableHead>
-                <TableHead className="text-right">Inscritos</TableHead>
+                <TableHead className="text-right">Participantes</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
@@ -41,7 +41,7 @@ export default async function Eventos() {
                   </TableCell>
                   <TableCell>{e.empresa.nome}</TableCell>
                   <TableCell><Badge variant="secondary">{TIPOS_EVENTO[e.tipo]}</Badge></TableCell>
-                  <TableCell className="text-right tabular-nums">{e.inscricoes[0]?.count ?? 0}</TableCell>
+                  <TableCell className="text-right tabular-nums">{e.participantes[0]?.count ?? 0}</TableCell>
                 </TableRow>
               ))}
               {eventos.length === 0 && (
```

- Apagar `src/app/participantes/[id]/page.tsx`.

- Apagar `src/app/participantes/actions.ts`.

- Apagar `src/app/participantes/importar/actions.ts`.

- Apagar `src/app/participantes/importar/importador.tsx`.

- Apagar `src/app/participantes/importar/page.tsx`.

- Apagar `src/app/participantes/modelo/route.ts`.

- Apagar `src/app/participantes/novo/page.tsx`.

- Apagar `src/app/participantes/page.tsx`.

Editar `src/components/menu-lateral.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/components/menu-lateral.tsx b/src/components/menu-lateral.tsx
index aadd907..f41fbef 100644
--- a/src/components/menu-lateral.tsx
+++ b/src/components/menu-lateral.tsx
@@ -2,7 +2,7 @@
 
 import Link from "next/link";
 import { usePathname } from "next/navigation";
-import { Building2, CalendarDays, FileSpreadsheet, QrCode, Users, type LucideIcon } from "lucide-react";
+import { Building2, CalendarDays, QrCode, type LucideIcon } from "lucide-react";
 import {
   Sidebar,
   SidebarContent,
@@ -19,10 +19,8 @@ import {
 import { GRUPOS, itemAtivo } from "@/lib/navegacao";
 
 const ICONES: Record<string, LucideIcon> = {
-  "/eventos": CalendarDays,
-  "/participantes": Users,
   "/empresas": Building2,
-  "/participantes/importar": FileSpreadsheet,
+  "/eventos": CalendarDays,
   "/checkin": QrCode,
 };
 
```

Reescrever `src/lib/busca.ts` inteiro:

```ts
import "server-only";
import { db } from "./supabase";
import { ehUuid } from "./dominio";
import { normalizarDocumento } from "./documento";
import { limparTermo } from "./texto";

export type ParticipanteEncontrado = {
  id: string;
  nome: string;
  documento: string;
  empresa: string | null;
  checkin_em: string | null;
  evento: { nome: string };
};

// Busca manual do check-in, para quem chega sem QR legível: nome sem acento ou parte do documento.
// Sem evento escolhido, procura em todos.
export async function buscarParticipantes(f: { termo: string; eventoId: string | null; limite?: number }): Promise<ParticipanteEncontrado[]> {
  const termo = limparTermo(f.termo);
  if (termo.length < 2) return [];
  const documento = normalizarDocumento(f.termo);
  let q = db()
    .from("participantes")
    .select("id, nome, documento, empresa, checkin_em, evento:eventos(nome)")
    .order("nome_busca")
    .limit(f.limite ?? 30);
  q = documento.length >= 3 ? q.or(`nome_busca.ilike.%${termo}%,documento.ilike.%${documento}%`) : q.ilike("nome_busca", `%${termo}%`);
  // Valor fora do domínio viraria erro de cast no Postgres; é ignorado.
  if (f.eventoId && ehUuid(f.eventoId)) q = q.eq("evento_id", f.eventoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as unknown as ParticipanteEncontrado[];
}

export async function listarEmpresas(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db().from("empresas").select("id, nome").order("nome");
  if (error) throw new Error(error.message);
  return data;
}
```

Editar `src/lib/credencial.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/credencial.ts b/src/lib/credencial.ts
index f0a49bc..c87526c 100644
--- a/src/lib/credencial.ts
+++ b/src/lib/credencial.ts
@@ -3,29 +3,32 @@ import { db } from "./supabase";
 import { formatarData, TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";
 import type { DadosCredencial } from "./pdf";
 
-export type Credencial = DadosCredencial & { inscricaoId: string; email: string | null };
+export type Credencial = DadosCredencial & { participanteId: string; email: string | null };
 
 type Linha = {
   id: string;
   codigo: string;
-  participante: { nome: string; tipo: TipoParticipante; email: string | null; empresa: { nome: string } | null };
+  nome: string;
+  tipo: TipoParticipante;
+  email: string | null;
+  empresa: string | null;
   evento: { nome: string; data: string };
 };
 
-const CAMPOS = "id, codigo, participante:participantes(nome, tipo, email, empresa:empresas(nome)), evento:eventos(nome, data)";
+const CAMPOS = "id, codigo, nome, tipo, email, empresa, evento:eventos(nome, data)";
 
 // Fonte única dos dados que vão no PDF: rota do PDF, ZIP do evento e e-mail.
 export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId: string }): Promise<Credencial[]> {
-  const base = db().from("inscricoes").select(CAMPOS);
+  const base = db().from("participantes").select(CAMPOS);
   const { data, error } = await ("ids" in filtro ? base.in("id", filtro.ids) : base.eq("evento_id", filtro.eventoId));
   if (error) throw new Error(error.message);
   return (data as unknown as Linha[])
     .map((l) => ({
-      inscricaoId: l.id,
-      email: l.participante.email,
-      nome: l.participante.nome,
-      tipo: TIPOS_PARTICIPANTE[l.participante.tipo],
-      empresa: l.participante.empresa?.nome ?? null,
+      participanteId: l.id,
+      email: l.email,
+      nome: l.nome,
+      tipo: TIPOS_PARTICIPANTE[l.tipo],
+      empresa: l.empresa,
       evento: l.evento.nome,
       data: formatarData(l.evento.data),
       codigo: l.codigo,
```

Editar `src/lib/dominio.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/dominio.ts b/src/lib/dominio.ts
index f622d98..50fb2cb 100644
--- a/src/lib/dominio.ts
+++ b/src/lib/dominio.ts
@@ -67,6 +67,8 @@ export const participanteSchema = z.object({
   data_nascimento: textoOpcional.refine((v) => v === null || dataIsoValida(v), "Data de nascimento inválida"),
   email: textoOpcional.refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido"),
   telefone: textoOpcional,
+  // Onde a pessoa trabalha (texto livre), não a empresa cliente dona do evento.
+  empresa: textoOpcional.transform((v) => v && v.replace(/\s+/g, " ")),
   tipo: z.enum(Object.keys(TIPOS_PARTICIPANTE) as [TipoParticipante, ...TipoParticipante[]], { message: "Tipo inválido" }),
 });
 export type ParticipanteInput = z.output<typeof participanteSchema>;
```

Editar `src/lib/navegacao.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/navegacao.ts b/src/lib/navegacao.ts
index a55df72..3d21dc6 100644
--- a/src/lib/navegacao.ts
+++ b/src/lib/navegacao.ts
@@ -2,25 +2,22 @@
 export const GRUPOS = [
   {
     titulo: "Gestão",
+    // Na ordem do trabalho: a empresa vem antes do evento.
     itens: [
-      { href: "/eventos", texto: "Eventos" },
-      { href: "/participantes", texto: "Participantes" },
       { href: "/empresas", texto: "Empresas" },
+      { href: "/eventos", texto: "Eventos" },
     ],
   },
   {
     titulo: "Operação",
-    itens: [
-      { href: "/participantes/importar", texto: "Importar planilha" },
-      { href: "/checkin", texto: "Check-in" },
-    ],
+    itens: [{ href: "/checkin", texto: "Check-in" }],
   },
 ] as const;
 
 const TODOS: string[] = GRUPOS.flatMap((g) => g.itens.map((i) => i.href));
 
 // Ativo é o item cujo caminho é o prefixo mais longo da rota atual:
-// em /participantes/importar acende "Importar planilha", e não "Participantes".
+// em /eventosx não acende "Eventos", e em /eventos/<id>/participantes/novo acende.
 export function itemAtivo(caminho: string): string | undefined {
   return TODOS.filter((h) => caminho === h || caminho.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
 }
@@ -32,7 +29,6 @@ const NOMES: Record<string, string> = {
   importar: "Importar planilha",
   novo: "Novo",
   editar: "Editar",
-  inscrever: "Inscrever",
 };
 
 // Cada segmento da URL vira um passo do breadcrumb; segmento desconhecido (o id) vira "Detalhe".
```

Editar `src/lib/planilha.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/planilha.ts b/src/lib/planilha.ts
index ffbd09b..cc87c63 100644
--- a/src/lib/planilha.ts
+++ b/src/lib/planilha.ts
@@ -23,7 +23,7 @@ const APELIDOS: Record<string, Coluna> = {
 };
 
 export type LinhaBruta = { linha: number } & Record<Coluna, string>;
-export type DadosImportacao = ParticipanteInput & { empresa: string | null };
+export type DadosImportacao = ParticipanteInput;
 export type LinhaValidada =
   | { linha: number; ok: true; dados: DadosImportacao }
   | { linha: number; ok: false; erros: string[] };
@@ -94,7 +94,7 @@ export function validarLinhas(linhas: LinhaBruta[]): LinhaValidada[] {
     const anterior = vistos.get(r.data.documento);
     if (anterior) return { linha: l.linha, ok: false, erros: [`Documento repetido na linha ${anterior}`] };
     vistos.set(r.data.documento, l.linha);
-    return { linha: l.linha, ok: true, dados: { ...r.data, empresa: l.empresa.replace(/\s+/g, " ").trim() || null } };
+    return { linha: l.linha, ok: true, dados: r.data };
   });
 }
 
```

Criar `supabase/migrations/20261006000001_participante_no_evento.sql`:

```sql
-- O participante pertence ao evento: a inscrição deixa de existir e o que era dela (código do QR,
-- check-in, status do e-mail) vira coluna do participante. Em 2026-10-06 produção tinha 0
-- participantes e 0 inscrições, por isso as tabelas são recriadas em vez de migradas.
drop table inscricoes;
drop table participantes;

create table participantes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  -- nome sem acento e minúsculo, preenchido pelo app (normalizarBusca); é onde a busca roda.
  nome_busca text not null,
  documento text not null check (documento ~ '^[0-9A-Z]+$'),
  data_nascimento date,
  email text,
  telefone text,
  -- Onde a pessoa trabalha, em texto livre. Não é a empresa cliente dona do evento.
  empresa text,
  tipo tipo_participante not null,
  -- O check-in procura só pelo código, por isso ele é único no banco inteiro.
  codigo text not null unique,
  checkin_em timestamptz,
  email_enviado_em timestamptz,
  email_erro text,
  created_at timestamptz not null default now(),
  unique (evento_id, documento)
);

alter table participantes enable row level security;
```

- [ ] **Step 4: Aplicar a migração**

Com a autorização registrada, confira de novo que `participantes` e `inscricoes` têm 0 linhas e aplique `supabase/migrations/20261006000001_participante_no_evento.sql` pelo `apply_migration` (nome `participante_no_evento`) no projeto `ybqlpcgjmguhecezslmj`. Confira: `select to_regclass('public.inscricoes');` → `null`; `select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'participantes';` → `15`.

- [ ] **Step 5: Rodar tudo**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\eslint.cmd .; & .\node_modules\.bin\vitest.cmd run`
Expected: tsc e eslint sem saída; `Tests  51 passed (51)`.

Confira também que nada mais fala de inscrição: busca (Grep) por `inscricoes`, `inscricaoId` e `inscrever` em `src/` → nenhum resultado.

- [ ] **Step 6: Ver no navegador**

No evento: "Adicionar participante" → salvar volta ao evento com a pessoa na tabela; repetir o mesmo CPF no mesmo evento mostra "Documento já cadastrado neste evento para …"; o nome na tabela abre a edição; "PDF" baixa de `/credenciais/<id>/pdf`; "Remover" tira do evento. `/participantes` dá 404 e o menu não tem mais "Participantes" nem "Importar planilha". Check-in pelo código e pela busca por nome. Screenshots 1440 e 390.

- [ ] **Step 7: Commit**

```bash
git add -A supabase src
git commit -m "Participante pertence ao evento"
```

---

### Tarefa 3: Credencial em PDF mais completa

O PDF ganha a empresa cliente no topo, o tipo do evento, o código impresso embaixo do QR, a linha "Credencial pessoal e intransferível." e o rodapé com as duas marcas. Os textos saem de uma função pura, `textosCredencial`, porque o pdf-lib grava o conteúdo comprimido e o texto não aparece cru no arquivo para um teste procurar.

**Files:**
- Modify: `src/lib/credencial.ts`
- Modify: `src/lib/pdf.test.ts`
- Modify: `src/lib/pdf.ts`

**Interfaces:**
- Consumes: `participantes` e `eventos.empresa_id` (Tarefas 1 e 2).
- Produces: `DadosCredencial = { nome; tipo; empresa: string | null; empresaCliente: string; evento; tipoEvento: string; data: "dd/mm/aaaa"; codigo }`; `textosCredencial(d)` → `{ empresaCliente, evento, subtitulo, codigo, nome, tipo, empresa, aviso, instrucao, rodape }`. O ano do rodapé é `d.data.slice(-4)`.

- [ ] **Step 1: Escrever o teste que falha**

Reescrever `src/lib/pdf.test.ts` inteiro:

```ts
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import { gerarCredencialPdf, textosCredencial } from "./pdf";
import { montarZip, nomeArquivo } from "./zip";

const dados = {
  nome: "José Conceição",
  tipo: "VIP",
  empresa: "Fornecedora Beta",
  empresaCliente: "Acme Ltda",
  evento: "Kickoff 2027",
  tipoEvento: "Premiação e incentivo",
  data: "15/01/2027",
  codigo: "AbCdEfGhIjKlMnOpQrStUv",
};

describe("textosCredencial", () => {
  it("monta cabeçalho, código impresso e rodapé com as duas marcas", () => {
    expect(textosCredencial(dados)).toEqual({
      empresaCliente: "ACME LTDA",
      evento: "Kickoff 2027",
      subtitulo: "Premiação e incentivo · 15/01/2027",
      codigo: "AbCdEfGhIjKlMnOpQrStUv",
      nome: "José Conceição",
      tipo: "VIP",
      empresa: "Fornecedora Beta",
      aviso: "Credencial pessoal e intransferível.",
      instrucao: "Apresente este QR code na entrada do evento.",
      rodape: "© 2027 Acme Ltda · Organização VM Events. Todos os direitos reservados.",
    });
  });

  it("o ano do rodapé é o do evento, não o de hoje", () => {
    expect(textosCredencial({ ...dados, data: "03/12/2026" }).rodape).toMatch(/^© 2026 /);
  });
});

describe("gerarCredencialPdf", () => {
  it("gera um PDF de uma página A4", async () => {
    const doc = await PDFDocument.load(await gerarCredencialPdf(dados));
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("não quebra com letra fora do WinAnsi, nome e empresa cliente enormes e sem empresa", async () => {
    const bytes = await gerarCredencialPdf({ ...dados, nome: "Łukasz Żółć 李 " + "Muito ".repeat(30), empresa: null, empresaCliente: "Grupo " + "Enorme ".repeat(40) });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe("montarZip", () => {
  it("nomeia pelo participante e não sobrescreve homônimos", () => {
    const pdf = new Uint8Array([1, 2, 3]);
    const zip = unzipSync(montarZip([{ nome: "João Silva", conteudo: pdf }, { nome: "João Silva", conteudo: pdf }, { nome: "../../etc", conteudo: pdf }]));
    expect(Object.keys(zip).sort()).toEqual(["etc.pdf", "joao-silva-2.pdf", "joao-silva.pdf"]);
  });

  it("nome só com símbolo vira participante", () => {
    expect(nomeArquivo("李")).toBe("participante");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/pdf.test.ts`
Expected: FAIL — `textosCredencial is not a function`.

- [ ] **Step 3: Implementar**

Editar `src/lib/credencial.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/credencial.ts b/src/lib/credencial.ts
index c87526c..75dee3e 100644
--- a/src/lib/credencial.ts
+++ b/src/lib/credencial.ts
@@ -1,6 +1,6 @@
 import "server-only";
 import { db } from "./supabase";
-import { formatarData, TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";
+import { formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "./dominio";
 import type { DadosCredencial } from "./pdf";
 
 export type Credencial = DadosCredencial & { participanteId: string; email: string | null };
@@ -12,10 +12,10 @@ type Linha = {
   tipo: TipoParticipante;
   email: string | null;
   empresa: string | null;
-  evento: { nome: string; data: string };
+  evento: { nome: string; tipo: TipoEvento; data: string; empresa: { nome: string } };
 };
 
-const CAMPOS = "id, codigo, nome, tipo, email, empresa, evento:eventos(nome, data)";
+const CAMPOS = "id, codigo, nome, tipo, email, empresa, evento:eventos(nome, tipo, data, empresa:empresas(nome))";
 
 // Fonte única dos dados que vão no PDF: rota do PDF, ZIP do evento e e-mail.
 export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId: string }): Promise<Credencial[]> {
@@ -29,7 +29,9 @@ export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId
       nome: l.nome,
       tipo: TIPOS_PARTICIPANTE[l.tipo],
       empresa: l.empresa,
+      empresaCliente: l.evento.empresa.nome,
       evento: l.evento.nome,
+      tipoEvento: TIPOS_EVENTO[l.evento.tipo],
       data: formatarData(l.evento.data),
       codigo: l.codigo,
     }))
```

Reescrever `src/lib/pdf.ts` inteiro:

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

export type DadosCredencial = {
  nome: string;
  tipo: string; // rótulo já legível: "VIP", "Palestrante"
  empresa: string | null; // onde o participante trabalha
  empresaCliente: string; // dona do evento
  evento: string;
  tipoEvento: string; // rótulo já legível: "Premiação e incentivo"
  data: string; // "17/05/2026"
  codigo: string;
};

// Todo texto da credencial, na ordem de cima para baixo. Separado do desenho para dar para testar:
// o pdf-lib grava o conteúdo comprimido, e o texto não aparece cru no arquivo.
export function textosCredencial(d: DadosCredencial) {
  const ano = d.data.slice(-4);
  return {
    empresaCliente: d.empresaCliente.toUpperCase(),
    evento: d.evento,
    subtitulo: `${d.tipoEvento} · ${d.data}`,
    codigo: d.codigo,
    nome: d.nome,
    tipo: d.tipo.toUpperCase(),
    empresa: d.empresa,
    aviso: "Credencial pessoal e intransferível.",
    instrucao: "Apresente este QR code na entrada do evento.",
    rodape: `© ${ano} ${d.empresaCliente} · Organização VM Events. Todos os direitos reservados.`,
  };
}

// Helvetica padrão só codifica WinAnsi (cobre português). Fora disso, tira acento e troca o resto por "?".
export function textoSeguro(fonte: PDFFont, texto: string): string {
  try {
    fonte.encodeText(texto);
    return texto;
  } catch {
    return texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7E]/g, "?");
  }
}

// Diminui a fonte até caber na largura; texto comprido não vaza da página.
function tamanhoQueCabe(fonte: PDFFont, texto: string, maximo: number, largura: number): number {
  let tamanho = maximo;
  while (tamanho > 6 && fonte.widthOfTextAtSize(texto, tamanho) > largura) tamanho -= 1;
  return tamanho;
}

export async function gerarCredencialPdf(d: DadosCredencial): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]); // A4 em pontos
  const { width, height } = pagina.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const margem = 56;
  const larguraUtil = width - margem * 2;
  const cinza = rgb(0.4, 0.4, 0.4);
  const t = textosCredencial(d);

  const centro = (texto: string, fonte: PDFFont, tamanho: number, y: number, cor = rgb(0.1, 0.1, 0.1)) => {
    const seguro = textoSeguro(fonte, texto);
    const s = tamanhoQueCabe(fonte, seguro, tamanho, larguraUtil);
    pagina.drawText(seguro, { x: (width - fonte.widthOfTextAtSize(seguro, s)) / 2, y, size: s, font: fonte, color: cor });
  };

  centro(t.empresaCliente, negrito, 11, height - 70, cinza);
  centro(t.evento, negrito, 22, height - 100);
  centro(t.subtitulo, regular, 12, height - 122, cinza);

  const png = await QRCode.toBuffer(d.codigo, { errorCorrectionLevel: "M", margin: 1, width: 600 });
  const qr = await pdf.embedPng(png);
  const lado = 280;
  pagina.drawImage(qr, { x: (width - lado) / 2, y: height - 150 - lado, width: lado, height: lado });
  // Impresso embaixo do QR: se a câmera falhar, a equipe digita no check-in.
  centro(t.codigo, mono, 12, height - 450, cinza);

  centro(t.nome, negrito, 30, height - 510);
  centro(t.tipo, negrito, 16, height - 542, cinza);
  if (t.empresa) centro(t.empresa, regular, 15, height - 566);

  centro(t.aviso, regular, 11, 120, cinza);
  centro(t.instrucao, regular, 11, 104, cinza);
  pagina.drawLine({ start: { x: margem, y: 84 }, end: { x: width - margem, y: 84 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
  centro(t.rodape, regular, 9, 64, cinza);

  return pdf.save();
}
```

- [ ] **Step 4: Rodar tudo**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\eslint.cmd .; & .\node_modules\.bin\vitest.cmd run`
Expected: tsc e eslint sem saída; `Tests  53 passed (53)`.

- [ ] **Step 5: Olhar o PDF**

Baixe o PDF de um participante e abra. De cima para baixo: empresa cliente em caixa alta e cinza; evento em negrito; "tipo · data"; QR; código em fonte mono; nome grande; tipo em caixa alta; empresa do participante; as duas linhas de aviso; filete; rodapé `© 2026 <Empresa> · Organização VM Events. Todos os direitos reservados.` Nada vaza da página.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdf.ts src/lib/pdf.test.ts src/lib/credencial.ts
git commit -m "Credencial em PDF com empresa, código impresso e rodapé"
```

---

### Tarefa 4: Exportar o evento em CSV

Botão "Exportar CSV" no evento baixa uma planilha com a empresa, o evento e cada participante, com presença e hora de chegada. A montagem é pura (`src/lib/csv.ts`); a rota só consulta e entrega.

**Files:**
- Create: `src/app/eventos/[id]/csv/route.ts`
- Modify: `src/app/eventos/[id]/page.tsx`
- Create: `src/lib/csv.test.ts`
- Create: `src/lib/csv.ts`

**Interfaces:**
- Consumes: `participantes.checkin_em`, `eventos.empresa_id` (Tarefas 1 e 2); `nomeArquivo` de `src/lib/zip.ts`.
- Produces: `celulaCsv(valor: string): string`; `csvDoEvento(evento: EventoCsv, participantes: ParticipanteCsv[]): string`; rota `GET /eventos/<id>/csv`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { celulaCsv, csvDoEvento } from "./csv";

const evento = { empresa: "Acme Ltda", nome: "Kickoff 2027", tipo: "kickoff" as const, data: "2027-01-15" };
const maria = {
  nome: "Maria da Silva",
  documento: "52998224725",
  data_nascimento: "1990-05-17",
  email: "maria@exemplo.com",
  telefone: "(11) 91234-5678",
  empresa: "Beta; Filial Sul",
  tipo: "vip" as const,
  // 13:05 em UTC = 10:05 em Brasília
  checkin_em: "2027-01-15T13:05:00+00:00",
};
const joao = { ...maria, nome: "João", documento: "11144477735", data_nascimento: null, email: null, telefone: null, empresa: null, checkin_em: null };

describe("celulaCsv", () => {
  it("põe entre aspas o que tem separador, aspas ou quebra de linha", () => {
    expect(celulaCsv("simples")).toBe("simples");
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
    expect(celulaCsv("linha\nnova")).toBe('"linha\nnova"');
  });

  it("neutraliza o que o Excel executaria como fórmula", () => {
    expect(celulaCsv("=1+1")).toBe("'=1+1");
    expect(celulaCsv("+55 11")).toBe("'+55 11");
    expect(celulaCsv("-2")).toBe("'-2");
    expect(celulaCsv("@SOMA(A1)")).toBe("'@SOMA(A1)");
    expect(celulaCsv("\tx")).toBe("'\tx");
  });
});

describe("csvDoEvento", () => {
  const csv = csvDoEvento(evento, [maria, joao]);
  const linhas = csv.slice(1).split("\r\n");

  it("começa com BOM e usa ; e CRLF", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas[0]).toBe(
      "empresa;evento;tipo_evento;data_evento;nome;documento;data_nascimento;email;telefone;empresa_participante;tipo;compareceu;chegada",
    );
  });

  it("uma linha por participante, com presença e chegada no horário de Brasília", () => {
    expect(linhas[1]).toBe(
      'Acme Ltda;Kickoff 2027;Kickoff;15/01/2027;Maria da Silva;52998224725;17/05/1990;maria@exemplo.com;(11) 91234-5678;"Beta; Filial Sul";VIP;Sim;15/01/2027 10:05',
    );
    expect(linhas[2]).toBe("Acme Ltda;Kickoff 2027;Kickoff;15/01/2027;João;11144477735;;;;;VIP;Não;");
    expect(linhas).toHaveLength(4); // cabeçalho, 2 participantes e a linha vazia depois do último CRLF
  });

  it("evento sem participantes sai só com o cabeçalho", () => {
    expect(csvDoEvento(evento, []).slice(1).split("\r\n")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/csv.test.ts`
Expected: FAIL — `Cannot find module './csv'`.

- [ ] **Step 3: Implementar**

Criar `src/app/eventos/[id]/csv/route.ts`:

```ts
import { db } from "@/lib/supabase";
import { ehUuid } from "@/lib/dominio";
import { csvDoEvento, type EventoCsv, type ParticipanteCsv } from "@/lib/csv";
import { nomeArquivo } from "@/lib/zip";

// Tudo do evento numa planilha: empresa, evento e cada participante com presença e hora de chegada.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Evento não encontrado", { status: 404 });
  const [{ data: evento }, { data, error }] = await Promise.all([
    db().from("eventos").select("nome, tipo, data, empresa:empresas(nome)").eq("id", id).maybeSingle(),
    db()
      .from("participantes")
      .select("nome, documento, data_nascimento, email, telefone, empresa, tipo, checkin_em")
      .eq("evento_id", id)
      .order("nome_busca"),
  ]);
  if (!evento) return new Response("Evento não encontrado", { status: 404 });
  if (error) throw new Error(error.message);
  const e = evento as unknown as Omit<EventoCsv, "empresa"> & { empresa: { nome: string } };
  const csv = csvDoEvento({ ...e, empresa: e.empresa.nome }, data as ParticipanteCsv[]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo(e.nome)}.csv"`,
    },
  });
}
```

Editar `src/app/eventos/[id]/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/[id]/page.tsx b/src/app/eventos/[id]/page.tsx
index 9f5ab89..e1c648e 100644
--- a/src/app/eventos/[id]/page.tsx
+++ b/src/app/eventos/[id]/page.tsx
@@ -59,6 +59,7 @@ export default async function Evento({ params }: { params: Promise<{ id: string
         </div>
         <div className="flex flex-wrap gap-2">
           <Link href={`/eventos/${id}/participantes/novo`} className={buttonVariants()}>Adicionar participante</Link>
+          <a href={`/eventos/${id}/csv`} className={buttonVariants({ variant: "outline" })}>Exportar CSV</a>
           <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
           <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
           <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todos os participantes dele?`} rotulo="Apagar evento" />
```

Criar `src/lib/csv.ts`:

```ts
import { formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "./dominio";

export type EventoCsv = { empresa: string; nome: string; tipo: TipoEvento; data: string };
export type ParticipanteCsv = {
  nome: string;
  documento: string;
  data_nascimento: string | null;
  email: string | null;
  telefone: string | null;
  empresa: string | null;
  tipo: TipoParticipante;
  checkin_em: string | null;
};

const CABECALHO = [
  "empresa", "evento", "tipo_evento", "data_evento", "nome", "documento", "data_nascimento",
  "email", "telefone", "empresa_participante", "tipo", "compareceu", "chegada",
];

// Excel executa como fórmula o que começa com = + - @ tab ou CR; o apóstrofo desliga isso.
// Separador, aspas ou quebra de linha: entre aspas, com aspas dobradas.
export function celulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

// "2027-01-15T13:05:00Z" -> "15/01/2027 10:05", no fuso de Brasília.
function chegada(iso: string): string {
  return new Date(iso)
    .toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    .replace(",", "");
}

// Separador ; e UTF-8 com BOM: é o que o Excel brasileiro abre sem juntar colunas nem estragar acento.
export function csvDoEvento(evento: EventoCsv, participantes: ParticipanteCsv[]): string {
  const linhas = participantes.map((p) => [
    evento.empresa,
    evento.nome,
    TIPOS_EVENTO[evento.tipo],
    formatarData(evento.data),
    p.nome,
    p.documento,
    formatarData(p.data_nascimento),
    p.email ?? "",
    p.telefone ?? "",
    p.empresa ?? "",
    TIPOS_PARTICIPANTE[p.tipo],
    p.checkin_em ? "Sim" : "Não",
    p.checkin_em ? chegada(p.checkin_em) : "",
  ]);
  return "﻿" + [CABECALHO, ...linhas].map((l) => l.map(celulaCsv).join(";") + "\r\n").join("");
}
```

- [ ] **Step 4: Rodar tudo**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\eslint.cmd .; & .\node_modules\.bin\vitest.cmd run`
Expected: tsc e eslint sem saída; `Tests  58 passed (58)`.

- [ ] **Step 5: Ver no navegador**

No evento, "Exportar CSV" baixa `<nome-do-evento>.csv`. Faça check-in de um participante e exporte de novo: a linha dele tem `Sim` e a hora; os outros, `Não` e chegada vazia. Screenshot do botão em 1440 e 390.

- [ ] **Step 6: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts "src/app/eventos/[id]/csv/route.ts" "src/app/eventos/[id]/page.tsx"
git commit -m "Exporta o evento em CSV com presença e hora de chegada"
```

---

### Tarefa 5: Importação de planilha dentro do evento, à prova de celular

A importação volta, agora em `/eventos/<id>/importar`, gravando no evento da página. O arquivo é lido para a memória assim que é escolhido (no Android, o arquivo do WhatsApp ou do Drive pode deixar de ser legível depois), e toda falha vira aviso na tela em vez de derrubar a página. O "Texto Unicode" do Excel (UTF-16) passa a ser lido. Reimportar mantém o código do QR de quem já está no evento.

Causa do erro relatado pelo autor (medida em 2026-10-06, ver spec §5): no PC, a planilha dele tinha tipos "Organizador" e "Padrão", que o sistema não aceita — resolvido na planilha, sem código. No celular, a promessa da Server Action rejeitava e o `importador.tsx` não tratava; é isso que esta tarefa corrige.

**Files:**
- Create: `src/app/eventos/[id]/importar/actions.test.ts`
- Create: `src/app/eventos/[id]/importar/actions.ts`
- Create: `src/app/eventos/[id]/importar/importador.tsx`
- Create: `src/app/eventos/[id]/importar/page.tsx`
- Modify: `src/app/eventos/[id]/page.tsx`
- Create: `src/app/modelo-planilha/route.ts`
- Modify: `src/lib/planilha.test.ts`
- Modify: `src/lib/planilha.ts`

**Interfaces:**
- Consumes: `participantes` com `unique(evento_id, documento)` (Tarefa 2); `lerPlanilha`, `validarLinhas`, `modeloPlanilha`, `COLUNAS` de `src/lib/planilha.ts`.
- Produces: `previsualizar(eventoId: string, form: FormData)` → `{ ok: false; mensagem } | { ok: true; previa: Previa }`; `importar(eventoId: string, form: FormData)` → `{ ok: boolean; mensagem }`; `Importador({ eventoId })`; rota `GET /modelo-planilha`. As duas ações **nunca rejeitam** por falha de banco: devolvem `{ ok: false, mensagem: "Não consegui consultar o evento. Tente de novo." }`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/app/eventos/[id]/importar/actions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

// O banco cai no meio da prévia: a Server Action precisa devolver { ok: false }, nunca rejeitar.
// Rejeição sobe para o error boundary e a página inteira vira "This page couldn't load".
vi.mock("@/lib/supabase", () => ({
  db: () => {
    throw new Error("fetch failed");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { importar, previsualizar } = await import("./actions");

const EVENTO = "3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f";

function formCom(csv: string): FormData {
  const form = new FormData();
  form.set("arquivo", new File([csv], "p.csv", { type: "text/csv" }));
  return form;
}

const CSV = "nome;documento;tipo\nAna;529.982.247-25;VIP\n";

describe("importação com o banco fora do ar", () => {
  it("prévia devolve mensagem em vez de rejeitar", async () => {
    await expect(previsualizar(EVENTO, formCom(CSV))).resolves.toEqual({
      ok: false,
      mensagem: "Não consegui consultar o evento. Tente de novo.",
    });
  });

  it("gravação devolve mensagem em vez de rejeitar", async () => {
    await expect(importar(EVENTO, formCom(CSV))).resolves.toEqual({
      ok: false,
      mensagem: "Não consegui consultar o evento. Tente de novo.",
    });
  });
});

describe("entrada inválida", () => {
  it("evento que não é uuid", async () => {
    await expect(previsualizar("nao-uuid", formCom(CSV))).resolves.toEqual({ ok: false, mensagem: "Evento inválido" });
  });

  it("sem arquivo", async () => {
    await expect(previsualizar(EVENTO, new FormData())).resolves.toEqual({ ok: false, mensagem: "Escolha um arquivo CSV ou Excel" });
  });
});
```

Editar `src/lib/planilha.test.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/planilha.test.ts b/src/lib/planilha.test.ts
index 4592c96..9e911c6 100644
--- a/src/lib/planilha.test.ts
+++ b/src/lib/planilha.test.ts
@@ -56,6 +56,17 @@ describe("lerPlanilha", () => {
     expect(l.nome).toBe("José Conceição");
   });
 
+  it("lê o \"Texto Unicode\" do Excel (UTF-16 com BOM, separado por tab)", () => {
+    const texto = "nome\tdocumento\ttipo\r\nJosé Conceição\t529.982.247-25\tVIP\r\n";
+    const le = new Uint8Array([0xff, 0xfe, ...Buffer.from(texto, "utf16le")]);
+    const be = new Uint8Array([0xfe, 0xff, ...Buffer.from(texto, "utf16le").swap16()]);
+    for (const bytes of [le, be]) {
+      expect(lerPlanilha(bytes)).toEqual([
+        { linha: 2, nome: "José Conceição", documento: "529.982.247-25", data_nascimento: "", email: "", telefone: "", empresa: "", tipo: "VIP" },
+      ]);
+    }
+  });
+
   it("ignora linha totalmente vazia e numera pela linha da planilha", () => {
     const linhas = lerPlanilha(xlsx([["nome", "documento"], ["Ana", "1"], ["", ""], ["Bia", "2"]]));
     expect(linhas.map((l) => l.linha)).toEqual([2, 4]);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run planilha importar`
Expected: FAIL em `lê o "Texto Unicode" do Excel…` (`expected [] to deeply equal [ { linha: 2, …(7) } ]`) e na suíte `actions.test.ts` (`Cannot find module './actions'`).

Este teste do banco fora do ar foi conferido contra o defeito: sem o `try/catch` em volta de `codigosNoEvento` na prévia, ele falha com `promise rejected "Error: fetch failed" instead of resolving` — exatamente o que derrubava a página.

- [ ] **Step 3: Implementar**

Criar `src/app/eventos/[id]/importar/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { ehUuid } from "@/lib/dominio";
import { lerPlanilha, validarLinhas, type LinhaValidada } from "@/lib/planilha";
import { normalizarBusca } from "@/lib/texto";
import { gerarCodigo } from "@/lib/codigo";

// Vercel recusa corpo acima de 4,5 MB e o next.config libera 4 MB para Server Actions.
const LIMITE_BYTES = 3 * 1024 * 1024;
const FALHA_BANCO = "Não consegui consultar o evento. Tente de novo.";

export type Previa = { linhas: (LinhaValidada & { existente?: boolean })[]; novos: number; existentes: number; comErro: number };
type Erro = { ok: false; mensagem: string };
type Lida = Erro | { ok: true; linhas: LinhaValidada[] };

async function ler(eventoId: string, form: FormData): Promise<Lida> {
  if (!ehUuid(eventoId)) return { ok: false, mensagem: "Evento inválido" };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, mensagem: "Escolha um arquivo CSV ou Excel" };
  if (arquivo.size > LIMITE_BYTES) return { ok: false, mensagem: "Arquivo maior que 3 MB. Divida a planilha em partes." };
  try {
    const linhas = validarLinhas(lerPlanilha(new Uint8Array(await arquivo.arrayBuffer())));
    if (linhas.length === 0) return { ok: false, mensagem: "A planilha não tem linhas de dados" };
    return { ok: true, linhas };
  } catch {
    return { ok: false, mensagem: "Não consegui ler o arquivo. Use o modelo em CSV ou Excel." };
  }
}

// Documento -> código do QR de quem já está no evento. Lança se o banco falhar.
// .in() vai na URL; em fatias de 200 a URL fica abaixo do limite do PostgREST mesmo com milhares de linhas.
async function codigosNoEvento(eventoId: string, documentos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (let i = 0; i < documentos.length; i += 200) {
    const { data, error } = await db()
      .from("participantes")
      .select("documento, codigo")
      .eq("evento_id", eventoId)
      .in("documento", documentos.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const d of data) mapa.set(d.documento as string, d.codigo as string);
  }
  return mapa;
}

export async function previsualizar(eventoId: string, form: FormData): Promise<Erro | { ok: true; previa: Previa }> {
  const lida = await ler(eventoId, form);
  if (!lida.ok) return lida;
  let ja: Map<string, string>;
  try {
    ja = await codigosNoEvento(eventoId, lida.linhas.flatMap((l) => (l.ok ? [l.dados.documento] : [])));
  } catch {
    return { ok: false, mensagem: FALHA_BANCO };
  }
  const linhas = lida.linhas.map((l) => (l.ok ? { ...l, existente: ja.has(l.dados.documento) } : l));
  return {
    ok: true,
    previa: {
      linhas,
      novos: linhas.filter((l) => l.ok && !l.existente).length,
      existentes: linhas.filter((l) => l.ok && l.existente).length,
      comErro: linhas.filter((l) => !l.ok).length,
    },
  };
}

// Recebe o MESMO arquivo de novo e revalida no servidor: nada que veio da prévia no navegador é confiado.
// Quem já está no evento é atualizado e mantém o código (o QR pode já estar impresso) e o check-in,
// que não vão no upsert.
export async function importar(eventoId: string, form: FormData): Promise<{ ok: boolean; mensagem: string }> {
  const lida = await ler(eventoId, form);
  if (!lida.ok) return lida;
  const validos = lida.linhas.flatMap((l) => (l.ok ? [l.dados] : []));
  if (validos.length === 0) return { ok: false, mensagem: "Nenhuma linha válida para gravar" };
  let ja: Map<string, string>;
  try {
    ja = await codigosNoEvento(eventoId, validos.map((p) => p.documento));
  } catch {
    return { ok: false, mensagem: FALHA_BANCO };
  }

  const { data: gravados, error } = await db()
    .from("participantes")
    .upsert(
      validos.map((p) => ({ ...p, nome_busca: normalizarBusca(p.nome), evento_id: eventoId, codigo: ja.get(p.documento) ?? gerarCodigo() })),
      { onConflict: "evento_id,documento" },
    )
    .select("id");
  if (error) return { ok: false, mensagem: `Erro ao gravar participantes: ${error.message}` };

  revalidatePath(`/eventos/${eventoId}`);
  const ignoradas = lida.linhas.length - validos.length;
  return { ok: true, mensagem: `${gravados.length} participantes gravados${ignoradas ? `, ${ignoradas} linhas com erro ignoradas` : ""}` };
}
```

Criar `src/app/eventos/[id]/importar/importador.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Campo } from "@/components/campo";
import { COLUNAS } from "@/lib/planilha";
import { importar, previsualizar, type Previa } from "./actions";

const FALHA_REDE = "Falha ao falar com o servidor. Tente de novo.";

export function Importador({ eventoId }: { eventoId: string }) {
  // Cópia em memória do arquivo escolhido. No Android, o arquivo vindo do WhatsApp ou do Drive pode
  // deixar de ser legível depois de escolhido; lido na hora, os dois envios usam estes bytes.
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const dados = () => {
    const form = new FormData();
    if (arquivo) form.set("arquivo", arquivo);
    return form;
  };

  return (
    <div className="grid gap-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Enviar planilha</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Colunas esperadas:{" "}
            {COLUNAS.map((c, i) => (
              <span key={c}>
                {i > 0 && ", "}
                <code className="font-mono">{c}</code>
              </span>
            ))}
            . Obrigatórias: nome, documento e tipo.{" "}
            <Link href="/modelo-planilha" className="underline">Baixar o modelo</Link>.
          </p>
          <Campo
            nome="arquivo"
            rotulo="Planilha (CSV ou Excel)"
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            required
            onChange={async (e) => {
              const campo = e.currentTarget;
              const escolhido = campo.files?.[0];
              setPrevia(null);
              setArquivo(null);
              if (!escolhido) return;
              try {
                setArquivo(new File([await escolhido.arrayBuffer()], escolhido.name, { type: escolhido.type }));
              } catch {
                campo.value = "";
                toast.error("Não consegui abrir o arquivo. Escolha de novo.");
              }
            }}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pendente || !arquivo}
            onClick={() =>
              iniciar(async () => {
                try {
                  const r = await previsualizar(eventoId, dados());
                  if (r.ok) setPrevia(r.previa);
                  else toast.error(r.mensagem);
                } catch {
                  toast.error(FALHA_REDE);
                }
              })
            }
          >
            {pendente && !previa ? "Lendo…" : "Ver prévia"}
          </Button>
        </CardFooter>
      </Card>

      {previa && (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Prévia</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sucesso/10 text-sucesso">{previa.novos} novos</Badge>
              <Badge variant="secondary">{previa.existentes} já no evento</Badge>
              {previa.comErro > 0 && <Badge variant="destructive">{previa.comErro} com erro</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              Quem já está no evento é atualizado com os dados da planilha e mantém o QR{previa.comErro > 0 ? "; linhas com erro não serão gravadas." : "."}
            </p>
            {previa.comErro > 0 && (
              <ul className="grid gap-1 text-sm text-destructive">
                {previa.linhas.flatMap((l) => (l.ok ? [] : [<li key={l.linha}>Linha {l.linha}: {l.erros.join("; ")}</li>]))}
              </ul>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="button"
              disabled={pendente || previa.novos + previa.existentes === 0}
              onClick={() =>
                iniciar(async () => {
                  try {
                    const r = await importar(eventoId, dados());
                    if (!r.ok) return void toast.error(r.mensagem);
                    toast.success(r.mensagem);
                    router.push(`/eventos/${eventoId}`);
                  } catch {
                    toast.error(FALHA_REDE);
                  }
                })
              }
            >
              {pendente ? "Gravando…" : `Gravar ${previa.novos + previa.existentes} participantes`}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
```

Criar `src/app/eventos/[id]/importar/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { ehUuid } from "@/lib/dominio";
import { db } from "@/lib/supabase";
import { Importador } from "./importador";

export default async function Importar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data: evento } = await db().from("eventos").select("nome").eq("id", id).maybeSingle();
  if (!evento) notFound();
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Importar planilha</h1>
        <p className="text-sm text-muted-foreground">Participantes da planilha entram em {evento.nome}.</p>
      </div>
      <Importador eventoId={id} />
    </section>
  );
}
```

Editar `src/app/eventos/[id]/page.tsx` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/app/eventos/[id]/page.tsx b/src/app/eventos/[id]/page.tsx
index e1c648e..42676c3 100644
--- a/src/app/eventos/[id]/page.tsx
+++ b/src/app/eventos/[id]/page.tsx
@@ -59,6 +59,7 @@ export default async function Evento({ params }: { params: Promise<{ id: string
         </div>
         <div className="flex flex-wrap gap-2">
           <Link href={`/eventos/${id}/participantes/novo`} className={buttonVariants()}>Adicionar participante</Link>
+          <Link href={`/eventos/${id}/importar`} className={buttonVariants({ variant: "outline" })}>Importar planilha</Link>
           <a href={`/eventos/${id}/csv`} className={buttonVariants({ variant: "outline" })}>Exportar CSV</a>
           <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
           <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
```

Criar `src/app/modelo-planilha/route.ts`:

```ts
import { modeloPlanilha } from "@/lib/planilha";

export function GET() {
  return new Response(Buffer.from(modeloPlanilha()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-participantes.xlsx"',
    },
  });
}
```

Editar `src/lib/planilha.ts` — aplicar este diff (`git apply`), ou fazer as mesmas trocas à mão:

```diff
diff --git a/src/lib/planilha.ts b/src/lib/planilha.ts
index cc87c63..0c7a523 100644
--- a/src/lib/planilha.ts
+++ b/src/lib/planilha.ts
@@ -55,8 +55,10 @@ function ehBinario(b: Uint8Array): boolean {
 }
 
 // SheetJS lê CSV sem BOM como Latin-1 e estraga UTF-8. Tenta UTF-8 estrito; se não for, é o
-// Windows-1252 que o Excel brasileiro grava.
+// Windows-1252 que o Excel brasileiro grava. BOM de UTF-16 é o "Texto Unicode" do Excel.
 function decodificarTexto(b: Uint8Array): string {
+  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b);
+  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b);
   try {
     return new TextDecoder("utf-8", { fatal: true }).decode(b);
   } catch {
```

- [ ] **Step 4: Rodar tudo**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\eslint.cmd .; & .\node_modules\.bin\vitest.cmd run`
Expected: tsc e eslint sem saída; `Test Files  11 passed (11)` e `Tests  63 passed (63)`.

- [ ] **Step 5: Ver no navegador**

No evento, "Importar planilha" → escolher um CSV fictício → "Ver prévia" mostra "N novos" → "Gravar" volta ao evento com as pessoas. Importar a mesma planilha de novo mostra "N já no evento" e os códigos na tabela não mudam. "Baixar o modelo" baixa de `/modelo-planilha`. Screenshots 1440 e 390, e repita o fluxo no perfil de celular do Playwright.

- [ ] **Step 6: Commit**

```bash
git add src/lib/planilha.ts src/lib/planilha.test.ts "src/app/eventos/[id]/importar" src/app/modelo-planilha "src/app/eventos/[id]/page.tsx"
git commit -m "Importação de planilha dentro do evento, sem derrubar a página no celular"
```

---

### Tarefa 6: Teste de ponta a ponta no fluxo novo

Reescreve o E2E para o fluxo empresa → evento → participantes → importação → PDF → check-in → reimportação → CSV, nos dois perfis (desktop e celular). **Este é o único código do plano que não foi executado antes** (ver "Como este plano foi verificado"): rode-o aqui, com as duas migrações aplicadas. Se algum passo falhar, investigue a causa no código das tarefas anteriores antes de mexer no teste.

**Files:**
- Modify: `e2e/fluxo.spec.ts`

**Interfaces:**
- Consumes: tudo das Tarefas 1–5. Rótulos e textos usados pelo teste: "Nome", "Nome do evento", "Empresa" (exato), "Tipo", "Data", "CPF ou documento", "Empresa do participante", "Planilha (CSV ou Excel)", "Ver prévia", "N novos", "N já no evento", "Gravar N participantes", "Presentes sobre participantes", "Código do QR", "Validar", "Evento".

- [ ] **Step 1: Escrever o teste**

Reescrever `e2e/fluxo.spec.ts` inteiro:

```ts
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Tudo que o teste cria leva este prefixo e é apagado no fim, mesmo se o teste falhar.
const SUFIXO = `${Date.now()}`;
const PREFIXO = `E2E ${SUFIXO}`;
const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function gerarCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const digito = (nums: number[]) => {
    const soma = nums.reduce((s, n, i) => s + n * (nums.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(base);
  return [...base, d1, digito([...base, d1])].join("");
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  // Apagar o evento apaga os participantes dele (on delete cascade).
  await db.from("eventos").delete().like("nome", `${PREFIXO}%`);
  await db.from("empresas").delete().like("nome", `${PREFIXO}%`);
});

test("empresa, evento, participantes, importação, PDF, check-in e CSV", async ({ page, request }, info) => {
  const tag = `${PREFIXO} ${info.project.name}`;
  const cpf = gerarCpf();
  const cpfImportado = gerarCpf();

  // Empresa, e a mesma de novo (com outra caixa) para ver a mensagem de duplicada
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} Acme`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/empresas$/);
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} ACME`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Já existe uma empresa com esse nome")).toBeVisible();

  // Evento criado de dentro da empresa: a empresa já vem escolhida
  const criarEvento = async (nome: string) => {
    await page.goto(`/empresas?q=${encodeURIComponent(`${tag} Acme`)}`);
    await page.getByRole("link", { name: `${tag} Acme` }).click();
    await page.getByRole("link", { name: "Novo evento" }).click();
    await expect(page.getByLabel("Empresa", { exact: true })).toHaveValue(/[0-9a-f-]{36}/);
    await page.getByLabel("Nome do evento").fill(nome);
    await page.getByLabel("Tipo").selectOption("kickoff");
    await page.getByLabel("Data").fill(hoje);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);
    return page.url().split("/").pop()!;
  };
  const outroId = await criarEvento(`${tag} Outro`);
  const eventoId = await criarEvento(`${tag} Kickoff`);
  await expect(page.getByRole("link", { name: `${tag} Acme` })).toBeVisible();

  // Empresa com evento não apaga
  await page.goto(`/empresas?q=${encodeURIComponent(`${tag} Acme`)}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Não dá para apagar")).toBeVisible();

  // Participante adicionado à mão
  const adicionar = async (evento: string) => {
    await page.goto(`/eventos/${evento}`);
    await page.getByRole("link", { name: "Adicionar participante" }).click();
    await page.getByLabel("Nome").fill(`${tag} José Conceição`);
    await page.getByLabel("CPF ou documento").fill(cpf);
    await page.getByLabel("Empresa do participante").fill("Fornecedora Beta");
    await page.getByLabel("Tipo").selectOption("vip");
    await page.getByRole("button", { name: "Salvar" }).click();
  };
  await adicionar(eventoId);
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  // O mesmo CPF de novo no mesmo evento é recusado...
  await adicionar(eventoId);
  await expect(page.getByText(/Documento já cadastrado neste evento/).first()).toBeVisible();
  // ...e em outro evento é outro cadastro (o participante pertence ao evento)
  await adicionar(outroId);
  await expect(page).toHaveURL(new RegExp(`/eventos/${outroId}$`));

  // Importação de planilha dentro do evento
  await page.goto(`/eventos/${eventoId}/importar`);
  await page.getByLabel("Planilha (CSV ou Excel)").setInputFiles({
    name: "participantes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`nome;documento;tipo;empresa\n${tag} Ana Importada;${cpfImportado};Convidado;Gama\n`),
  });
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText("1 novos")).toBeVisible();
  await page.getByRole("button", { name: "Gravar 1 participantes" }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("0/2");

  const linha = page.getByRole("row", { name: new RegExp(`${tag} José Conceição`) });
  const codigo = (await linha.locator(".font-mono").innerText()).trim();
  expect(codigo).toMatch(/^[A-Za-z0-9_-]{22}$/);

  // PDF individual e ZIP
  const pdfHref = await linha.getByRole("link", { name: "PDF" }).getAttribute("href");
  const pdf = await request.get(pdfHref!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const zip = await request.get(`/eventos/${eventoId}/zip`);
  expect(zip.headers()["content-type"]).toBe("application/zip");

  // Check-in pelo campo de código: verde, depois amarelo, desconhecido e outro evento
  await page.goto("/checkin");
  await page.getByLabel("Evento").selectOption(eventoId);
  const validar = async (c: string) => {
    await page.getByLabel("Código do QR").fill(c);
    await page.getByRole("button", { name: "Validar" }).click();
  };
  await validar(codigo);
  await expect(page.getByText("Check-in feito · entregar crachá")).toBeVisible();
  await page.waitForTimeout(3100); // a mesma leitura em menos de 3 s é ignorada de propósito
  await validar(codigo);
  await expect(page.getByText(/Já fez check-in às/)).toBeVisible();
  await validar("codigo-que-nao-existe");
  await expect(page.getByText("Código não encontrado")).toBeVisible();
  await page.getByLabel("Evento").selectOption(outroId);
  await validar(codigo);
  await expect(page.getByText("QR de outro evento")).toBeVisible();

  await page.goto(`/eventos/${eventoId}`);
  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("1/2");

  // Reimportar quem já fez check-in atualiza os dados, mas mantém o QR impresso e a presença
  await page.goto(`/eventos/${eventoId}/importar`);
  await page.getByLabel("Planilha (CSV ou Excel)").setInputFiles({
    name: "reimportacao.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`nome;documento;tipo;empresa\n${tag} José Conceição;${cpf};VIP;Fornecedora Nova\n`),
  });
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByText("1 já no evento")).toBeVisible();
  await page.getByRole("button", { name: "Gravar 1 participantes" }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  await expect(page.getByLabel("Presentes sobre participantes")).toHaveText("1/2");
  await expect(linha.locator(".font-mono")).toHaveText(codigo);
  await expect(linha.getByText("Fornecedora Nova")).toBeVisible();

  // CSV do evento: quem veio tem Sim e a hora de chegada; quem não veio, Não
  const csv = await (await request.get(`/eventos/${eventoId}/csv`)).text();
  const linhas = csv.split("\r\n");
  expect(linhas.find((l) => l.includes("José Conceição"))).toMatch(
    new RegExp(`^${tag} Acme;${tag} Kickoff;Kickoff;.*;VIP;Sim;\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}$`),
  );
  expect(linhas.find((l) => l.includes("Ana Importada"))).toMatch(/;Gama;Convidado;Não;$/);
});
```

- [ ] **Step 2: Rodar**

Run: `& .\node_modules\.bin\playwright.cmd test`
Expected: `2 passed` (desktop e celular). O teste apaga no fim tudo o que criou (prefixo `E2E <timestamp>`); confira depois com `select count(*) from empresas where nome like 'E2E %';` → `0`.

- [ ] **Step 3: Rodar tudo e o build**

Run: `& .\node_modules\.bin\tsc.cmd --noEmit; & .\node_modules\.bin\eslint.cmd .; & .\node_modules\.bin\vitest.cmd run; & .\node_modules\.bin\next.cmd build`
Expected: `Tests  63 passed (63)` e o build termina listando as rotas, entre elas `/eventos/[id]/csv`, `/eventos/[id]/importar`, `/credenciais/[id]/pdf` e `/modelo-planilha`, e nenhuma `/participantes`.

- [ ] **Step 4: Commit**

```bash
git add e2e/fluxo.spec.ts
git commit -m "E2E no fluxo empresa, evento e participantes"
```

