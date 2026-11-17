# Contas e login (fatia 1 do SaaS) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a senha única do navegador por login com Supabase Auth, com cada usuário dentro de uma conta e os dados de eventos isolados por conta no banco (RLS), mais as telas de administração de contas e usuários.

**Architecture:** Duas migrações: a primeira cria `contas`, `usuarios` e as funções de sessão sem tocar nas tabelas de eventos; a segunda põe `conta_id` nas três tabelas de eventos com políticas RLS, no mesmo passo em que as 36 chamadas a `db()` passam a usar o cliente com o token do usuário. O login é uma Server Action que grava o cookie de sessão; `src/proxy.ts` renova a sessão e redireciona quem não tem. A chave `service_role` fica restrita a `src/app/admin/**` e ao cadastro de usuários, com um teste que falha se outro arquivo a importar. O Basic Auth continua como alternativa até a última tarefa.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, Server Actions), `@supabase/ssr` 0.12.x, `@supabase/supabase-js`, Postgres RLS no Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-saas-barbearia-design.md` (seções 1, 2, 8, 9 e 10).

## Global Constraints

- Next 16: ler `node_modules/next/dist/docs/` antes de usar uma API do Next (`AGENTS.md`). `cookies()` é assíncrono; o arquivo de middleware chama-se `proxy.ts` e já existe.
- Comandos pelo PowerShell, binário direto: typecheck `& .\node_modules\.bin\tsc.cmd --noEmit -p .`; lint `& .\node_modules\.bin\eslint.cmd src e2e playwright.config.ts`; unitários `& .\node_modules\.bin\vitest.cmd run`; E2E `npm run e2e` (exige `.env.local`).
- Tudo em português do Brasil: nomes de arquivo, funções, textos de tela, mensagens de commit.
- Repositório público: nenhum e-mail, nome ou senha reais em código, teste, issue ou commit. Usuários de teste levam prefixo `E2E` e são apagados no fim.
- `dbServico()` (chave `service_role`) só pode ser importado por `src/app/admin/**`, `src/lib/usuarios.ts`, `src/lib/supabase.ts` e `scripts/**`. A fatia 2 acrescenta `src/app/b/**`; a 3, `src/app/api/**`.
- O Basic Auth (`ADMIN_USER`/`ADMIN_PASSWORD`) continua funcionando como alternativa à sessão até a Tarefa 7, que só roda depois de o autor criar o primeiro usuário em produção.
- Produção: projeto Supabase `bedudumhtxflidndgqqz`, migrações por `npx supabase db push` (CLI já vinculada; `supabase/.temp/project-ref` confirma). Antes da Tarefa 2, backup pelo painel (Database → Backups) ou `npx supabase db dump --data-only`.
- Tela nova ou alterada: screenshot real (`browser_take_screenshot`) no Playwright MCP em 1440 e 390 de largura, tema claro e escuro, antes de dar por pronta. A área logada segue o visual AdminCN já existente (`src/components/ui/*`); não há portão de design nesta fatia.
- Chave publicável do Supabase: `SUPABASE_ANON_KEY` no `.env.local` e na Vercel (production e preview). Se faltar no `.env.local`, obter com `npx supabase projects api-keys --project-ref bedudumhtxflidndgqqz` (campo `anon`). Sem ela, bloquear a tarefa nomeando a variável.

## Review Focus

1. `?proximo=https://outro-site` no login não pode redirecionar para fora: `destinoSeguro` devolve `/` para qualquer coisa que não comece com uma única `/` (teste na Tarefa 1).
2. E-mail digitado com espaços e maiúsculas (`" Ana@Email.com "`) tem que entrar: o schema de login normaliza com `trim` e `toLowerCase` (teste na Tarefa 1).
3. Sessão expirada no meio de um formulário não pode virar erro 500: `mensagemErro` traduz o código `42501` (RLS negou) para "Sua sessão expirou. Entre de novo." (teste na Tarefa 2).
4. QR de participante de outra conta no check-in devolve "não encontrado", não os dados do outro: o teste de acesso prova que `select ... eq('codigo')` de outra conta volta vazio (Tarefa 2).
5. Usuário desativado com o navegador ainda logado perde o acesso no próximo pedido: o E2E desativa um usuário e confere que a tentativa seguinte de entrar falha e que a sessão antiga cai para `/entrar` (Tarefa 4).

---

### Task 1: Contas, usuários, clientes Supabase e tela de login

**Files:**
- Create: `supabase/migrations/20261117000000_contas_e_usuarios.sql`
- Modify: `src/lib/supabase.ts`
- Create: `src/lib/sessao.ts`
- Create: `src/app/entrar/page.tsx`, `src/app/entrar/actions.ts`
- Modify: `src/proxy.ts`
- Modify: `src/lib/navegacao.ts`, `src/lib/dominio.ts`, `src/components/casca.tsx`, `src/components/menu-lateral.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`
- Modify: `.env.example`, `package.json` (dependência `@supabase/ssr`)
- Test: `src/lib/navegacao.test.ts`, `src/lib/dominio.test.ts`, `src/lib/supabase.test.ts`, `e2e/sessao.ts` (ajudante), `e2e/login.spec.ts`, `e2e/fluxo.spec.ts`, `e2e/volume.spec.ts`, `e2e/tema.spec.ts`

**Interfaces:**
- Consumes: `db()` atual de `src/lib/supabase.ts`; `EstadoAcao`, `valoresDo`, `errosDoZod` de `src/lib/acao.ts`; `Campo` de `src/components/campo.tsx`.
- Produces:
  - `dbServico(): SupabaseClient` (o `db()` de hoje, renomeado; `export const db = dbServico` fica até a Tarefa 2).
  - `dbUsuario(): Promise<SupabaseClient>` — `createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: { getAll, setAll } })` sobre `await cookies()` de `next/headers`; `setAll` dentro de `try/catch` (em Server Component o cookie não pode ser escrito; o `proxy.ts` renova).
  - `src/lib/sessao.ts`: `type Papel = "dono" | "barbeiro"`; `type Usuario = { id: string; nome: string; email: string; papel: Papel; adminPlataforma: boolean; conta: { id: string; nome: string; slug: string; modulos: string[] } }`; `usuarioAtual(): Promise<Usuario | null>` (embrulhado em `cache` do React: `getClaims()` em `dbUsuario()`, depois `usuarios` com `contas(*)`); `exigirUsuario(): Promise<Usuario>` (`redirect("/entrar")` se nulo); `exigirDono(): Promise<Usuario>` e `exigirAdmin(): Promise<Usuario>` (`notFound()` se não for).
  - `src/lib/navegacao.ts`: `type Visao = { papel: Papel; adminPlataforma: boolean; modulos: string[] }`; `type Grupo = { titulo: string; itens: { href: string; texto: string }[] }`; `gruposPara(v: Visao): Grupo[]` substitui a constante `GRUPOS` (módulo `eventos` só para `dono`: grupos "Gestão" (Empresas, Eventos) e "Operação" (Check-in); `dono` ganha "Conta" (Usuários, `/usuarios`); `adminPlataforma` ganha "Plataforma" (Contas, `/admin/contas`); `barbeiro` sem módulo barbearia não vê nada); `itemAtivo(caminho: string, grupos: Grupo[])`; `destinoSeguro(proximo: string | undefined): string`; `inicioDe(v: Visao): string` (dono com `eventos` → `/eventos`; senão admin → `/admin/contas`; senão dono → `/usuarios`; senão `/minha-conta`). `NOMES` do breadcrumb ganha `entrar: "Entrar"`, `"minha-conta": "Minha conta"`, `usuarios: "Usuários"`, `admin: "Plataforma"`, `contas: "Contas"`.
  - `src/lib/dominio.ts`: `entrarSchema = z.object({ email: z.email().trim().toLowerCase(), senha: z.string().min(1), proximo: z.string().optional() })`.
  - `src/app/entrar/actions.ts`: `entrar(_: EstadoAcao, form: FormData): Promise<EstadoAcao>` (falha → `{ ok: false, mensagem: "E-mail ou senha incorretos", valores: { email } }`; sucesso → `redirect(destinoSeguro(proximo))`); `sair(): Promise<void>` (`signOut()` + `redirect("/entrar")`).
  - `e2e/sessao.ts`: `criarContaDeTeste(prefixo: string, modulos?: string[]): Promise<{ contaId: string }>`; `criarUsuarioDeTeste(prefixo: string, contaId: string, extra?: { papel?: Papel; adminPlataforma?: boolean }): Promise<{ id: string; email: string; senha: string }>`; `entrar(page: Page, email: string, senha: string): Promise<void>`; `apagarDadosDeTeste(prefixo: string): Promise<void>` (apaga usuários do Auth pelo prefixo do e-mail e as contas pelo nome).

- [ ] **Step 1: Instalar `@supabase/ssr` e escrever os testes unitários que falham**

`npm i @supabase/ssr`. Em `src/lib/navegacao.test.ts`:

```ts
describe("destinoSeguro", () => {
  it("aceita caminho interno e recusa externo, vazio e protocol-relative", () => {
    expect(destinoSeguro("/eventos/abc")).toBe("/eventos/abc");
    expect(destinoSeguro("https://outro-site")).toBe("/");
    expect(destinoSeguro("//outro-site")).toBe("/");
    expect(destinoSeguro(undefined)).toBe("/");
    expect(destinoSeguro("/entrar")).toBe("/");
  });
});
describe("gruposPara e inicioDe", () => {
  const dono = { papel: "dono", adminPlataforma: false, modulos: ["eventos"] } as const;
  const barbeiro = { ...dono, papel: "barbeiro" } as const;
  const admin = { papel: "dono", adminPlataforma: true, modulos: [] } as const;
  it("dono com eventos: Gestão, Operação, Conta; barbeiro sem barbearia: nada; admin sem módulo: Conta e Plataforma", () => {
    expect(gruposPara(dono).map((g) => g.titulo)).toEqual(["Gestão", "Operação", "Conta"]);
    expect(gruposPara(barbeiro)).toEqual([]);
    expect(gruposPara(admin).map((g) => g.titulo)).toEqual(["Conta", "Plataforma"]);
  });
  it("início: /eventos, /minha-conta, /admin/contas", () => {
    expect(inicioDe(dono)).toBe("/eventos");
    expect(inicioDe(barbeiro)).toBe("/minha-conta");
    expect(inicioDe(admin)).toBe("/admin/contas");
  });
  it("itemAtivo usa os grupos recebidos", () => {
    expect(itemAtivo("/eventos/abc/participantes", gruposPara(dono))).toBe("/eventos");
    expect(itemAtivo("/eventos/abc", gruposPara(barbeiro))).toBeUndefined();
  });
});
```

`menu-lateral.tsx` ganha ícones `/usuarios` → `Users` e `/admin/contas` → `Building`; nesta tarefa ele ainda chama `gruposPara` com a visão do usuário recebida por props (a `Casca` repassa `usuario`); o cabeçalho com o nome da conta e a barra com o usuário ficam para a Tarefa 3.

Em `src/lib/dominio.test.ts`: `entrarSchema.parse({ email: " Ana@Email.com ", senha: "x" }).email === "ana@email.com"`; e-mail inválido e senha vazia reprovam.

Em `src/lib/supabase.test.ts` (roda em Node, lê o sistema de arquivos):

```ts
it("dbServico só é importado pelos arquivos permitidos", () => {
  const permitidos = [/^src[\\/]app[\\/]admin[\\/]/, /^src[\\/]lib[\\/]usuarios\.ts$/, /^src[\\/]lib[\\/]supabase\.ts$/, /^scripts[\\/]/];
  const infratores = arquivosTs("src").filter((f) => /\bdbServico\b/.test(readFileSync(f, "utf8")) && !permitidos.some((p) => p.test(f)) && !f.endsWith(".test.ts"));
  expect(infratores).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/navegacao.test.ts src/lib/dominio.test.ts src/lib/supabase.test.ts`
Expected: FAIL — `destinoSeguro`, `inicioDe`, `entrarSchema` não existem; o teste de importação passa vazio (ainda não há `dbServico`).

- [ ] **Step 3: Migração A**

`supabase/migrations/20261117000000_contas_e_usuarios.sql`:

- `create type papel_usuario as enum ('dono', 'barbeiro');`
- `contas (id uuid pk default gen_random_uuid(), nome text not null check (btrim(nome) <> ''), slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'), modulos text[] not null default '{}', fuso text not null default 'America/Sao_Paulo', created_at timestamptz not null default now())`.
- `usuarios (id uuid pk references auth.users (id) on delete cascade, conta_id uuid not null references contas (id) on delete cascade, nome text not null check (btrim(nome) <> ''), email text not null, papel papel_usuario not null, admin_plataforma boolean not null default false, created_at timestamptz not null default now())`, índice em `conta_id`.
- `conta_atual()` e `papel_atual()`: `language sql stable security definer set search_path = public`, lendo `usuarios` por `auth.uid()`; `revoke all ... from public; grant execute ... to authenticated;`.
- RLS ligado nas duas; políticas para `authenticated`: `contas` select `id = conta_atual()`; `usuarios` select `conta_id = conta_atual()`. Sem política de escrita (escrita só por `service_role`).
- `insert into contas (nome, slug, modulos) values ('VM Events', 'vm-events', '{eventos}');`

Aplicar: `npx supabase db push`. Confirmar com `npx supabase migration list` que a migração aparece como aplicada no remoto.

- [ ] **Step 4: Clientes e sessão**

`src/lib/supabase.ts`: renomear `db` para `dbServico`, manter `export const db = dbServico;` com comentário "some na Tarefa 2", acrescentar `dbUsuario()` conforme *Produces*. Lança erro claro se `SUPABASE_ANON_KEY` faltar. `src/lib/sessao.ts` conforme *Produces*.

- [ ] **Step 5: Login, saída e proxy**

`src/app/entrar/page.tsx`: tela centralizada, sem menu, com `Card` e dois `Campo` (e-mail, senha) e botão "Entrar"; mostra `mensagem` do estado; lê `?proximo=` e manda em campo oculto; rodapé "Esqueceu a senha? Fale com o responsável pela sua conta." `src/app/entrar/actions.ts` conforme *Produces*.

`src/proxy.ts` (ler `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` e o exemplo de `setAll` do `@supabase/ssr` para middleware):

1. Cria `createServerClient` com `request.cookies.getAll()` e `setAll` que grava em `NextResponse.next({ request })`.
2. `const { data } = await supabase.auth.getClaims()`; com usuário → devolve a resposta (cookies renovados). Se o caminho for `/entrar` com usuário, redireciona para `/`.
3. Sem usuário: `/entrar` passa; senão, se `ADMIN_USER` e `ADMIN_PASSWORD` existirem, segue o fluxo Basic de hoje (401 ou passa); senão `redirect` para `/entrar?proximo=<pathname+search>`.
4. `matcher` igual ao de hoje.

`src/components/casca.tsx`: recebe `usuario: Usuario | null`; sem usuário ou em `/entrar`, renderiza só `<main>` (como já faz em `/checkin`); com usuário, passa a visão (`papel`, `adminPlataforma`, `conta.modulos`) ao `MenuLateral`. `src/app/layout.tsx` vira `async`, chama `usuarioAtual()` e passa para `Casca`. `src/app/page.tsx`: `redirect(inicioDe(visao))` após `exigirUsuario()`. Até a Tarefa 4, `/minha-conta` e `/usuarios` são 404: só o dono com `eventos` e o admin têm destino real nesta tarefa, e é isso que o E2E exercita.

`.env.example`: `SUPABASE_ANON_KEY=` com comentário; `ADMIN_*` ganham a nota "transição: saem quando o login estiver no ar".

- [ ] **Step 6: Ajudantes e E2E de login**

`e2e/sessao.ts` conforme *Produces* (cliente `service_role` como em `fluxo.spec.ts`; e-mail `e2e-<prefixo em minúsculas>-<n>@exemplo.test`, senha aleatória de 12 caracteres; `auth.admin.createUser({ email, password, email_confirm: true })` e `insert` em `usuarios`). `e2e/login.spec.ts`:

```ts
test("sem sessão vai para /entrar e volta para a página pedida", ...)   // goto /eventos → URL /entrar?proximo=%2Feventos; entra → URL /eventos
test("senha errada mostra a mensagem e mantém o e-mail", ...)            // "E-mail ou senha incorretos"
test("proximo externo cai na inicial", ...)                              // /entrar?proximo=https://outro-site → após entrar, URL /eventos
test("sair volta para /entrar e /eventos exige login de novo", ...)
```

`afterAll`: `apagarDadosDeTeste(PREFIXO)`.

`e2e/fluxo.spec.ts`, `e2e/volume.spec.ts` e `e2e/tema.spec.ts`: sem sessão o proxy agora redireciona, então cada um ganha em `beforeAll` `criarContaDeTeste(PREFIXO, ["eventos"])` + `criarUsuarioDeTeste(PREFIXO, contaId)` e, no início do teste (ou `beforeEach`), `entrar(page, email, senha)`; `afterAll` chama `apagarDadosDeTeste(PREFIXO)` além das limpezas atuais. O `request` do Playwright compartilha os cookies da página. Os dados continuam saindo pela chave `service_role` nesta tarefa, então o conteúdo dos testes não muda.

- [ ] **Step 7: Rodar tudo**

Run: `& .\node_modules\.bin\vitest.cmd run`; `& .\node_modules\.bin\tsc.cmd --noEmit -p .`; `& .\node_modules\.bin\eslint.cmd src e2e playwright.config.ts`; `npm run e2e`
Expected: tudo verde, os quatro E2E inclusive.

Screenshot de `/entrar` em 1440 e 390, claro e escuro.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261117000000_contas_e_usuarios.sql src/lib/supabase.ts src/lib/sessao.ts src/app/entrar src/proxy.ts src/lib/navegacao.ts src/lib/dominio.ts src/components/casca.tsx src/app/layout.tsx src/app/page.tsx .env.example package.json package-lock.json src/lib/*.test.ts e2e/sessao.ts e2e/login.spec.ts
git commit -m "Login com Supabase Auth: contas, usuários e tela de entrada"
```

---

### Task 2: Dados de eventos isolados por conta (RLS) e troca de `db()` por `dbUsuario()`

**Files:**
- Create: `supabase/migrations/20261117000001_conta_nos_eventos.sql`
- Modify: os 19 arquivos que chamam `db()` (`src/app/empresas/actions.ts`, `src/app/empresas/page.tsx`, `src/app/empresas/[id]/page.tsx`, `src/app/checkin/actions.ts`, `src/app/checkin/page.tsx`, `src/app/eventos/actions.ts`, `src/app/eventos/page.tsx`, `src/app/eventos/[id]/csv/route.ts`, `src/app/eventos/[id]/editar/page.tsx`, `src/app/eventos/[id]/email-actions.ts`, `src/app/eventos/[id]/page.tsx`, `src/app/eventos/[id]/zip/route.ts`, `src/app/eventos/[id]/importar/actions.ts`, `src/app/eventos/[id]/importar/page.tsx`, `src/app/eventos/[id]/participantes/[pid]/page.tsx`, `src/app/eventos/[id]/participantes/novo/page.tsx`, `src/app/eventos/[id]/participantes/actions.ts`, `src/lib/busca.ts`, `src/lib/credencial.ts`) e `src/lib/supabase.ts` (remove `db`)
- Modify: `src/lib/erros.ts`, `e2e/fluxo.spec.ts`, `e2e/volume.spec.ts`
- Test: `src/lib/erros.test.ts`, `src/lib/rls.test.ts`

**Interfaces:**
- Consumes: `dbUsuario()`, `dbServico()`, `e2e/sessao.ts` da Tarefa 1.
- Produces: tabelas `empresas`, `eventos`, `participantes` com `conta_id uuid not null default conta_atual()` e política `conta_id = conta_atual()`; `mensagemErro` cobre `42501`.

- [ ] **Step 1: Testes que falham**

`src/lib/erros.test.ts`: `mensagemErro({ code: "42501", message: "" })` → `"Sua sessão expirou. Entre de novo."`.

`src/lib/rls.test.ts` (integração; no topo, `if (existsSync(".env.local")) process.loadEnvFile(".env.local")`; `describe.skipIf(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY)`):

- `beforeAll`: com `service_role`, cria contas `RLS A <sufixo>` e `RLS B <sufixo>`, um usuário dono em cada (como em `e2e/sessao.ts`, mas aqui dentro do teste), e para cada um `createClient(URL, ANON).auth.signInWithPassword(...)`.
- `it("empresa criada por A não aparece para B")`: A insere `empresas { nome }` (sem `conta_id`: o default preenche); B `select` por esse nome → `[]`; A → 1 linha.
- `it("B não consegue inserir, alterar nem apagar na conta de A")`: insert com `conta_id` de A → erro `42501`; update e delete pelo id da empresa de A → `count 0`.
- `it("participante de outra conta não aparece pelo código")`: A cria evento e participante com `codigo`; B `select ... eq("codigo", codigo).maybeSingle()` → `data === null`.
- `it("usuário vê a própria conta e nenhuma outra")`: `from("contas").select("id")` para A → só a conta de A.
- `afterAll`: `auth.admin.deleteUser` dos dois e delete das contas (cascade apaga o resto).

- [ ] **Step 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/erros.test.ts src/lib/rls.test.ts`
Expected: `erros` FAIL (mensagem genérica); `rls` FAIL logo no primeiro insert de A: hoje as tabelas têm RLS ligado sem política nenhuma, e o cliente com token do usuário recebe `42501`.

- [ ] **Step 3: Migração B**

`supabase/migrations/20261117000001_conta_nos_eventos.sql`:

- Para `empresas`, `eventos`, `participantes`: `add column conta_id uuid references contas (id) on delete cascade`; `update ... set conta_id = (select id from contas where slug = 'vm-events')`; `alter column conta_id set not null`; `alter column conta_id set default conta_atual()`; índice em `conta_id`.
- `drop index empresas_nome_unico; create unique index empresas_nome_unico on empresas (conta_id, lower(nome));`
- Política por tabela: `create policy "conta" on <tabela> for all to authenticated using (conta_id = conta_atual()) with check (conta_id = conta_atual());`

Antes do push: backup (ver Global Constraints). Aplicar com `npx supabase db push`.

- [ ] **Step 4: Trocar as chamadas**

Em cada arquivo da lista: `import { dbUsuario } from "@/lib/supabase"` e `(await dbUsuario()).from(...)`; quando houver várias chamadas na mesma função, `const banco = await dbUsuario();` uma vez. Em `src/lib/busca.ts` e `src/lib/credencial.ts`, idem dentro das funções (assinaturas não mudam). Remover `export const db` de `src/lib/supabase.ts`. Nenhum `insert` precisa passar `conta_id`: o default do banco preenche.

`src/lib/erros.ts`: `42501` → `"Sua sessão expirou. Entre de novo."`.

- [ ] **Step 5: E2E**

Os E2E já entram com um usuário de teste desde a Tarefa 1. Conferir que `fluxo.spec.ts` continua passando agora que as leituras passam pelo RLS: a limpeza do `afterAll` apaga pela chave `service_role` e não muda. Acrescentar em `fluxo.spec.ts` uma asserção: logado como um segundo usuário de outra conta de teste, `/eventos` não lista o evento criado.

- [ ] **Step 6: Rodar tudo**

Run: `& .\node_modules\.bin\vitest.cmd run`; typecheck; lint; `npm run e2e`
Expected: tudo verde, inclusive `rls.test.ts` e os quatro E2E.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261117000001_conta_nos_eventos.sql src e2e
git commit -m "Eventos isolados por conta: RLS e cliente com o token do usuário"
```

---

### Task 3: Menu por conta e papel, usuário na barra superior

**Files:**
- Modify: `src/components/menu-lateral.tsx`, `src/components/barra-superior.tsx`, `src/components/casca.tsx`
- Test: `e2e/login.spec.ts`

**Interfaces:**
- Consumes: `Usuario`, `sair` e `gruposPara` da Tarefa 1.
- Produces: `MenuLateral({ visao, contaNome })` e `BarraSuperior({ nome })`.

- [ ] **Step 1: E2E que falha** — em `login.spec.ts`, após entrar: o cabeçalho do menu mostra o nome da conta de teste; a barra superior mostra o nome do usuário; "Sair" existe na barra; clicar em "Sair" leva a `/entrar`.

- [ ] **Step 2: Rodar e ver falhar** — `npm run e2e -- login.spec.ts`, FAIL: o nome da conta não aparece.

- [ ] **Step 3: Implementar**

`MenuLateral`: cabeçalho mostra `contaNome` e, embaixo, "CRM" (no lugar de "CRM de eventos / Credenciamento"). `BarraSuperior` recebe `{ nome }` e ganha à direita o nome do usuário (oculto abaixo de `md`), link "Minha conta" (`/minha-conta`, página na Tarefa 4) e um `<form action={sair}>` com botão "Sair". A `Casca` repassa `usuario.nome` e `usuario.conta.nome`.

- [ ] **Step 4: Rodar tudo** (unitários, typecheck, lint, `npm run e2e`), screenshots 1440/390 da tela de eventos logada, claro e escuro.

- [ ] **Step 5: Commit** — `git commit -m "Nome da conta no menu; usuário e saída na barra superior"`

---

### Task 4: Gestão de usuários da conta e troca de senha

**Files:**
- Create: `src/lib/senha.ts`, `src/lib/usuarios.ts`
- Create: `src/app/usuarios/page.tsx`, `src/app/usuarios/actions.ts`, `src/app/usuarios/formulario.tsx`
- Create: `src/app/minha-conta/page.tsx`, `src/app/minha-conta/actions.ts`
- Modify: `src/lib/dominio.ts`
- Test: `src/lib/senha.test.ts`, `src/lib/dominio.test.ts`, `e2e/usuarios.spec.ts`

**Interfaces:**
- Consumes: `exigirDono`, `exigirUsuario`, `dbServico`, `dbUsuario`.
- Produces:
  - `gerarSenhaTemporaria(): string` — 10 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` (sem 0/O/1/l/I), via `crypto.getRandomValues`.
  - `src/lib/usuarios.ts` (`server-only`, único lugar fora de `admin/**` que usa `dbServico`): `criarUsuario(d: { nome: string; email: string; senha: string; papel: Papel; contaId: string; adminPlataforma?: boolean }): Promise<{ id: string }>` (`auth.admin.createUser` com `email_confirm: true` + insert em `usuarios`; e-mail repetido → lança `Error("Já existe um usuário com esse e-mail")`); `redefinirSenha(id: string): Promise<string>` (gera, `auth.admin.updateUserById(id, { password })`, devolve a senha); `desativarUsuario(id: string)` (`ban_duration: "876000h"`); `reativarUsuario(id: string)` (`ban_duration: "none"`); `estaDesativado(u: { banned_until?: string | null }): boolean`.
  - `usuarioSchema = z.object({ nome: z.string().trim().min(1), email: z.email().trim().toLowerCase(), papel: z.enum(["dono", "barbeiro"]), senha: z.string().min(8) })`; `novaSenhaSchema = z.object({ senha: z.string().min(8), confirmacao: z.string() }).refine(iguais)`.
  - Server Actions em `src/app/usuarios/actions.ts` (todas começam com `const dono = await exigirDono()` e conferem que o alvo é da conta do dono lendo `usuarios` por `dbUsuario()`): `salvarUsuario(_: EstadoAcao, form): Promise<EstadoAcao>`; `redefinirSenhaDe(id): Promise<EstadoAcao>` (mensagem: `Senha temporária de <nome>: <senha>. Anote: ela não aparece de novo.`); `alternarAtivo(id): Promise<EstadoAcao>`.
  - `src/app/minha-conta/actions.ts`: `trocarSenha(_: EstadoAcao, form): Promise<EstadoAcao>` (`(await dbUsuario()).auth.updateUser({ password })`).

- [ ] **Step 1: Testes que falham** — `senha.test.ts`: 200 senhas geradas, todas com 10 caracteres só do alfabeto, nenhuma repetida; `dominio.test.ts`: `usuarioSchema` normaliza e-mail e recusa senha de 7; `novaSenhaSchema` recusa confirmação diferente.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** libs, schemas e telas. `/usuarios` (só dono; barbeiro cai em `notFound`): tabela nome, e-mail, papel, estado (Ativo/Desativado) e ações "Redefinir senha" e "Desativar"/"Reativar" (`BotaoApagar` existente serve de modelo de confirmação); acima, formulário "Novo usuário" (nome, e-mail, papel, senha inicial). O dono não pode desativar a si mesmo (ação devolve erro). `/minha-conta`: nome, e-mail, conta, papel e formulário "Trocar senha".

- [ ] **Step 4: E2E `usuarios.spec.ts`** — dono de teste entra; cria usuário `E2E` papel dono; sai; o novo entra e vê Eventos; dono redefine a senha do novo e lê a temporária na mensagem; novo entra com ela e troca em `/minha-conta`; dono desativa o novo; o novo tenta entrar e recebe "E-mail ou senha incorretos"; numa segunda aba já logada como o novo, recarregar `/eventos` cai em `/entrar`.

- [ ] **Step 5: Rodar tudo** (inclui o teste de importação de `dbServico`: `src/lib/usuarios.ts` é permitido), screenshots de `/usuarios` e `/minha-conta`.

- [ ] **Step 6: Commit** — `git commit -m "Usuários da conta: criar, redefinir senha, desativar; troca de senha"`

---

### Task 5: Administração da plataforma

**Files:**
- Create: `src/app/admin/contas/page.tsx`, `src/app/admin/contas/novo/page.tsx`, `src/app/admin/contas/[id]/page.tsx`, `src/app/admin/contas/actions.ts`, `src/app/admin/contas/formulario.tsx`
- Modify: `src/lib/dominio.ts`, `src/lib/texto.ts`
- Test: `src/lib/texto.test.ts`, `src/lib/dominio.test.ts`, `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `exigirAdmin`, `dbServico`, `criarUsuario`, `redefinirSenha`, `desativarUsuario`, `reativarUsuario`.
- Produces: `slugDe(nome: string): string` em `texto.ts` (sem acento, minúsculas, não-alfanumérico vira `-`, sem `-` nas pontas, máximo 40); `MODULOS = { eventos: "Eventos", barbearia: "Barbearia" } as const`; `contaSchema = z.object({ nome: z.string().trim().min(1), slug: z.string().regex(/^[a-z0-9-]{3,40}$/), modulos: z.array(z.enum(["eventos", "barbearia"])), fuso: z.string().default("America/Sao_Paulo") })`; Server Actions `salvarConta(_: EstadoAcao, form)`, `salvarUsuarioDaConta(_: EstadoAcao, form)` (campo oculto `conta_id`), `redefinirSenhaAdmin(id)`, `alternarAtivoAdmin(id)`, todas atrás de `exigirAdmin()` e usando `dbServico()`.

- [ ] **Step 1: Testes que falham** — `slugDe("Barbearia do Zé")` → `"barbearia-do-ze"`; `slugDe("  --Ação--  ")` → `"acao"`; `contaSchema` recusa slug com maiúscula e módulo desconhecido e aceita `modulos: []`. Na action, os checkboxes chegam como vários valores: `contaSchema.parse({ ...valores, modulos: form.getAll("modulos") })`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** — `/admin/contas`: tabela nome, slug, módulos (badges), nº de usuários, criada em; botão "Nova conta". Formulário: nome (preenche o slug ao digitar, pelo `slugDe`, editável), módulos em checkboxes, fuso (`<select>` com `America/Sao_Paulo`, `America/Manaus`, `America/Fortaleza`, `America/Cuiaba`). `/admin/contas/[id]`: editar dados e módulos; lista de usuários da conta (e-mail, papel, estado) com "Redefinir senha" e "Desativar/Reativar"; formulário "Novo usuário" igual ao da Tarefa 4 com `papel` padrão `dono`. Apagar conta fica fora (sem botão).

- [ ] **Step 4: E2E `admin.spec.ts`** — admin de teste (`adminPlataforma: true`) entra e vê "Plataforma"; cria conta `E2E Barbearia <sufixo>` com módulo `eventos`; cria o dono dela; sai; dono entra, vê o nome da conta no menu, vê "Gestão" e não vê "Plataforma"; `/admin/contas` para o dono devolve 404; lista de empresas do dono está vazia (não vê as da conta do admin).

- [ ] **Step 5: Rodar tudo**, screenshots das três telas.

- [ ] **Step 6: Commit** — `git commit -m "Administração da plataforma: contas, módulos e usuários"`

---

### Task 6: Primeiro administrador, README e variáveis

**Files:**
- Create: `scripts/primeiro-admin.ts`
- Modify: `README.md`, `.env.example`, `package.json` (script `"primeiro-admin": "node --env-file=.env.local scripts/primeiro-admin.ts"`)

**Interfaces:**
- Consumes: nada do app (o script usa `@supabase/supabase-js` direto com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, para rodar sem build).
- Produces: `npm run primeiro-admin -- <email> <senha> [nome]` cria (ou atualiza, se o e-mail já existir) o usuário com `papel = dono`, `admin_plataforma = true`, `conta = vm-events`. Sai com código 1 e mensagem clara se faltar argumento, variável ou a conta `vm-events`.

- [ ] **Step 1: Escrever o script** (Node 24 executa `.ts` direto; sem `enum` nem `namespace`). Idempotente: procura o usuário por e-mail em `auth.admin.listUsers`; existe → `updateUserById` com a senha e `upsert` em `usuarios`; não existe → cria.

- [ ] **Step 2: Verificar** — rodar local com um e-mail `e2e-admin-<n>@exemplo.test`, entrar em `/entrar` com ele, ver "Plataforma" no menu, rodar de novo com outra senha e entrar com a nova; apagar o usuário no fim (`auth.admin.deleteUser`). Registrar a saída no IMPLEMENTACAO.md.

- [ ] **Step 3: README** — seção "Login e contas": variáveis (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), primeiro acesso (`npm run primeiro-admin`), papéis, como criar conta e usuário, "esqueci a senha" sem e-mail. Em "Produção": adicionar `SUPABASE_ANON_KEY` na Vercel, rodar `primeiro-admin` apontando o `.env.local` para produção, **só então** remover `ADMIN_USER`/`ADMIN_PASSWORD` (Tarefa 7). Atualizar a menção ao check-in com usuário e senha do navegador.

- [ ] **Step 4: Rodar lint e typecheck** (o script entra no `tsconfig`? Se o `include` não cobrir `scripts/`, acrescentar).

- [ ] **Step 5: Commit** — `git commit -m "Script do primeiro administrador e README do login"`

---

### Task 7: Remover o Basic Auth

**Pré-condição (bloqueia se não cumprida):** o autor confirmou, em comentário na issue, que rodou `npm run primeiro-admin` contra produção, entrou em `https://vmevents.vercel.app/entrar` e removeu `ADMIN_USER`/`ADMIN_PASSWORD` da Vercel. Sem esse comentário, aplicar o label de bloqueio e parar.

**Files:**
- Modify: `src/proxy.ts`
- Delete: `src/lib/acesso.ts`, `src/lib/acesso.test.ts`
- Modify: `.env.example`, `README.md`

- [ ] **Step 1: Remover** o ramo Basic do `proxy.ts` (sem usuário → `/entrar`, sempre), os dois arquivos de `acesso`, as variáveis do `.env.example` e as menções do README.

- [ ] **Step 2: Rodar tudo** (unitários, typecheck, lint, `npm run e2e`). Conferir que `grep -rn "ADMIN_USER" src e2e README.md .env.example` não devolve nada.

- [ ] **Step 3: Commit** — `git commit -m "Remove o Basic Auth: o login é só por sessão"`
