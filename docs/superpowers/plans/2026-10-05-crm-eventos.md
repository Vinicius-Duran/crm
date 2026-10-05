# CRM de eventos — plano de implementação

> **Para agentes:** execução pelo agente `coordenador` (`/realizar-tarefas` com os números das issues), que roda cada tarefa por desenvolvedor → code-reviewer-task → finalizador. Fora do pipeline, use superpowers:subagent-driven-development ou superpowers:executing-plans. Passos em checkbox (`- [ ]`).

**Objetivo:** CRM de eventos com cadastro de empresas, participantes e eventos, importação de planilha, credencial em PDF com QR code por inscrição, envio por e-mail e check-in pelo celular.

**Arquitetura:** Next.js 16 (App Router) na Vercel. Páginas e Server Actions rodam no servidor e são as únicas que falam com o Supabase, usando a chave secreta. O banco tem RLS ligado sem política, então a API pública do Supabase não lê nada. A lógica que pode errar em silêncio (CPF, planilha, PDF, nomes de arquivo) fica em módulos puros de `src/lib/`, com teste unitário.

**Stack:** Next.js 16.3.8, React 19, TypeScript, Tailwind 4, shadcn (Base UI), @supabase/supabase-js 2.117, zod 4, pdf-lib 1.17, qrcode 1.5, fflate 0.8, SheetJS 0.20.3 (tarball da CDN), qr-scanner 1.4, resend 6.32, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-10-05-crm-eventos-design.md`

## Como este plano foi verificado

Todo o código abaixo foi **executado antes** de entrar aqui, num app Next 16.3.8 criado com os mesmos comandos da Tarefa 1:

| o quê | resultado |
| --- | --- |
| `vitest run` | 39 testes passando (unitários de `src/lib/`) |
| `tsc --noEmit` e `eslint` | limpos, inclusive na versão intermediária da página do evento (Tarefa 6) |
| `next build` com variáveis falsas | passa; todas as 18 rotas saem dinâmicas (`ƒ`) |
| `next start` + download de `/participantes/modelo` | o .xlsx baixado tem o cabeçalho e a linha de exemplo |
| migração SQL num Postgres embutido (PGlite) | unicidade, `restrict`, `cascade` e o check-in condicional se comportam como descrito |
| QR gerado → decodificado com jsQR | devolve o código original |

**Não executado:** Server Actions e páginas contra um Supabase de verdade. Elas estão tipadas e passam no build, mas a primeira execução real é o E2E da Tarefa 10. Divergência entre o código e o comportamento do banco é para reportar, e não para contornar em silêncio.

Defeitos que a execução pegou e que já estão corrigidos no código abaixo:
- CSV UTF-8 sem BOM era lido como Latin-1 ("JosÃ©");
- data de CSV "05/06/1990" virava 6 de maio (leitura americana);
- `XLSX.write` devolve `ArrayBuffer`, e não `Uint8Array`;
- `on delete restrict` devolve SQLSTATE `23001`, e não `23503`;
- o número serial do Excel no comentário de um teste estava errado. A conta: 32994 − 25569 = 7425 dias = 1990-05-01.

## Restrições globais

- **Interface em português do Brasil.** Datas em `dd/mm/aaaa`, horários em `America/Sao_Paulo`.
- **O Supabase só é acessado pelo servidor.** `src/lib/supabase.ts` começa com `import "server-only"`. Nunca exponha a chave com `NEXT_PUBLIC_` nem importe `db()` em arquivo `"use client"`.
- **Next 16 tem mudanças incompatíveis com o que você conhece.** Leia `node_modules/next/dist/docs/` antes de usar uma API do Next. Alguns fatos verificados:
  - `params` e `searchParams` são `Promise`;
  - `useActionState` vem de `react`;
  - `middleware` virou `proxy` (este projeto não usa nenhum dos dois);
  - Server Action aceita 1 MB por padrão.
- **O shadcn atual usa Base UI, e não Radix.** Formulários usam `<select>` nativo, pelo componente `Selecao`. Link com cara de botão é `<Link className={buttonVariants()}>`, e não `<Button asChild>`.
- **Resposta binária** sai com `new Response(Buffer.from(bytes))`. Um `Uint8Array` direto quebra o typecheck.
- **Anexo do Resend vai em base64** (`Buffer.from(pdf).toString("base64")`). Se for `Uint8Array`, o SDK o serializa como objeto e o arquivo chega corrompido.
- **Testes unitários** rodam pelo PowerShell, chamando o binário direto: `& .\node_modules\.bin\vitest.cmd run`. A saída do `npm test` pelo Bash deste ambiente pode chegar corrompida (ver `.claude/contexto-empresa.md`).
- **Front-end:** todo trabalho visual (Tarefas 3, 4, 6, 7 e 8) passa pelas cinco skills obrigatórias do autor, nesta ordem:
  1. `taste-skill`;
  2. `refero`, com busca de referência real antes de escolher paleta e tipo;
  3. `emil-design-eng`;
  4. `impeccable`;
  5. 21st.dev.

  A Tarefa 3 fixa a direção visual, e as seguintes a seguem. Animação, quando houver, sai de GSAP ou anime.js, só em `transform`/`opacity`, e quem esconde para revelar é o JS, nunca o CSS. Serif de display não entra. **Nada está pronto sem screenshot do Playwright em 1440 e 390 de largura.**
- **O código de UI deste plano é a base funcional, e não o visual final.** Classes, espaçamento, tipografia e cor podem mudar pela direção da Tarefa 3. Não podem mudar: os nomes e rótulos de campo (o E2E da Tarefa 10 depende deles), a lógica das actions e os textos dos cartões de check-in.
- **Na dúvida sobre um número ou uma regra, pergunte em vez de inventar.** No pipeline desassistido, isso significa marcar BLOQUEADO com a pergunta.

## Foco da revisão

Cinco condições que a spec implica, que pegariam uma pessoa usando o sistema e que um teste óbvio não cobre. Cada uma tem teste na tarefa dona:

1. **Planilha salva pelo Excel brasileiro:** Windows-1252, separador `;`, data `dd/mm/aaaa` e CPF numérico sem o zero à esquerda. Tem que chegar intacta. → Tarefa 7 (`planilha.test.ts`).
2. **O mesmo QR lido duas vezes, ou por dois celulares:** um verde e um amarelo, nunca dois verdes. → Tarefa 8, com o UPDATE condicional verificado no SQL, e Tarefa 10 (E2E).
3. **Nome com letra fora do WinAnsi ou nome enorme no PDF:** o PDF tem que sair mesmo assim, sem estourar a página. → Tarefa 5 (`pdf.test.ts`).
4. **Busca com vírgula, parêntese ou `%`:** não pode quebrar o filtro `.or()` do PostgREST. → Tarefa 2 (`limparTermo`).
5. **QR de um evento lido no check-in de outro:** vermelho com o nome do evento certo, e sem marcar presença. → Tarefa 10 (E2E).

## Mapa de arquivos

```
src/lib/            lógica pura (testada) + acesso ao banco (server-only)
  documento.ts      CPF: normalizar e validar
  texto.ts          sem acento, termo de busca seguro, escape de HTML
  codigo.ts         código aleatório do QR
  dominio.ts        tipos, rótulos, schemas zod, datas, uuid
  acao.ts           estado das Server Actions de formulário
  erros.ts          SQLSTATE → frase
  planilha.ts       ler CSV/Excel e validar linhas
  pdf.ts            credencial A4 com QR
  zip.ts            ZIP com nomes únicos
  supabase.ts       cliente com chave secreta (server-only)
  busca.ts          busca de participantes e lista de empresas (server-only)
  credencial.ts     dados de uma ou várias credenciais (server-only)
  email.ts          envio pelo Resend (server-only)
src/components/     campo.tsx, botao-apagar.tsx, ui/* (shadcn)
src/app/            empresas/, participantes/, eventos/, inscricoes/, checkin/
supabase/migrations/20261005000000_schema_inicial.sql
e2e/fluxo.spec.ts, playwright.config.ts
```

---

### Tarefa 1: Fundação — projeto, banco e cliente do Supabase

**Arquivos:**
- Criar: o projeto Next.js na raiz do repositório
- Criar: `next.config.ts`, `vitest.config.mts`, `.env.example`, `supabase/migrations/20261005000000_schema_inicial.sql`, `src/lib/supabase.ts`, `src/lib/erros.ts`
- Modificar: `.gitignore`, `package.json` (scripts)
- Teste: `src/lib/erros.test.ts`

**Interfaces:**
- Produz: `db(): SupabaseClient`; `mensagemErro(e: { code?: string; message: string }, unico?: string): string`; as quatro tabelas e os dois enums do banco.

**Pré-requisito do autor:** o projeto Supabase precisa existir e o MCP do Supabase precisa estar autenticado (`/mcp` → supabase → Authenticate), com o `project_ref` fixado no `.mcp.json`. Sem isso, o passo 7 fica BLOQUEADO, e a tarefa entrega o resto e registra a migração como pendente.

- [ ] **Passo 1: Gerar o projeto.** O `create-next-app` recusa diretório com `README.md` ou `.mcp.json`. Tire os dois da frente, gere e devolva:

```powershell
Move-Item README.md ..\README.keep.md; Move-Item .mcp.json ..\mcp.keep.json
npx --yes create-next-app@16.3.8 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack --yes
Move-Item ..\README.keep.md README.md -Force; Move-Item ..\mcp.keep.json .mcp.json -Force
```

Esperado: "Success! Created …". O gerador cria `AGENTS.md` e `CLAUDE.md` com as regras do Next 16. Mantenha os dois e commite-os, porque o `next dev` os recria.

- [ ] **Passo 2: Instalar as dependências.** O SheetJS do npm (0.18.5) está abandonado; a versão atual vem da CDN oficial. `@types/node` precisa ser `^24` por causa do Vitest 5.

```powershell
npm i @supabase/supabase-js pdf-lib qrcode fflate qr-scanner resend zod server-only https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm i -D "@types/node@^24" vitest @types/qrcode @playwright/test
```

- [ ] **Passo 3: Configuração.** Em `package.json`, acrescente aos `scripts`: `"test": "vitest run"` e `"e2e": "playwright test"`. Em `.gitignore`, logo abaixo da linha `.env*`, acrescente:

```
!.env.example
.tarefas/
test-results/
playwright-report/
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Upload de planilha passa por Server Action, que por padrão aceita só 1 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
```

`vitest.config.mts`. A extensão `.mts` evita o aviso de "ESM em arquivo CommonJS" do Vite:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
```

`.env.example`:

```bash
# Supabase → Project Settings → API Keys. A chave secreta (service_role ou sb_secret_…) ignora RLS:
# só na Vercel e no .env.local, nunca no Git e nunca com prefixo NEXT_PUBLIC_.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Opcional. Sem as duas, o botão de e-mail aparece desligado com a explicação.
# EMAIL_FROM precisa ser de um domínio verificado no Resend, ex.: "Eventos <credenciais@suaempresa.com.br>"
RESEND_API_KEY=
EMAIL_FROM=
```

- [ ] **Passo 4: Escrever o teste que falha** em `src/lib/erros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mensagemErro } from "./erros";

describe("mensagemErro", () => {
  it("traduz unicidade com a frase de quem chamou", () => {
    expect(mensagemErro({ code: "23505", message: "duplicate key" }, "Empresa já cadastrada")).toBe("Empresa já cadastrada");
  });
  it("traduz restrict (23001) e FK (23503) como registro em uso", () => {
    expect(mensagemErro({ code: "23001", message: "x" })).toBe("Não dá para apagar: há cadastros ligados a este registro");
    expect(mensagemErro({ code: "23503", message: "x" })).toBe("Não dá para apagar: há cadastros ligados a este registro");
  });
  it("erro desconhecido mostra a mensagem original", () => {
    expect(mensagemErro({ message: "fetch failed" })).toBe("Erro ao salvar: fetch failed");
  });
});
```

- [ ] **Passo 5: Rodar e ver falhar.** `& .\node_modules\.bin\vitest.cmd run src/lib/erros.test.ts`. Esperado: FAIL, porque não existe `./erros`.

- [ ] **Passo 6: Implementar** `src/lib/erros.ts` e `src/lib/supabase.ts`:

```ts
// Erro do PostgREST/Postgres -> frase para quem está usando o sistema.
// `code` é o SQLSTATE do Postgres. `on delete restrict` devolve 23001; FK sem ação devolve 23503.
export type ErroBanco = { code?: string; message: string };

export function mensagemErro(e: ErroBanco, unico = "Já existe um cadastro com esse valor"): string {
  if (e.code === "23505") return unico;
  if (e.code === "23001" || e.code === "23503") return "Não dá para apagar: há cadastros ligados a este registro";
  return `Erro ao salvar: ${e.message}`;
}
```

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

// Chave service_role: ignora RLS. Por isso este módulo é server-only — importá-lo num
// componente de cliente quebra o build em vez de vazar a chave para o navegador.
export function db(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente");
  cliente = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return cliente;
}
```

Rode de novo. Esperado: 3 testes passando.

- [ ] **Passo 7: Migração.** Crie `supabase/migrations/20261005000000_schema_inicial.sql` e aplique no projeto Supabase pelo MCP (`apply_migration`, nome `schema_inicial`):

```sql
-- CRM de eventos: esquema inicial.
-- RLS ligado sem política: a API pública do Supabase (anon/authenticated) não lê nem escreve nada.
-- Só o servidor Next.js, com a chave service_role (que ignora RLS), acessa as tabelas.

create type tipo_participante as enum ('palestrante', 'vip', 'autoridade', 'convidado');

create type tipo_evento as enum (
  'palestra', 'workshop', 'treinamento', 'kickoff', 'lancamento',
  'premiacao_incentivo', 'demonstracao_produto', 'feedback'
);

create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  created_at timestamptz not null default now()
);
create unique index empresas_nome_unico on empresas (lower(nome));

create table participantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  -- nome sem acento e minúsculo, preenchido pelo app (normalizarBusca); é onde a busca roda.
  nome_busca text not null,
  documento text not null unique check (documento ~ '^[0-9A-Z]+$'),
  data_nascimento date,
  email text,
  telefone text,
  empresa_id uuid references empresas (id) on delete restrict,
  tipo tipo_participante not null,
  created_at timestamptz not null default now()
);
create index participantes_empresa on participantes (empresa_id);

create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  tipo tipo_evento not null,
  data date not null,
  created_at timestamptz not null default now()
);

create table inscricoes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references participantes (id) on delete cascade,
  evento_id uuid not null references eventos (id) on delete cascade,
  codigo text not null unique,
  checkin_em timestamptz,
  email_enviado_em timestamptz,
  email_erro text,
  created_at timestamptz not null default now(),
  unique (participante_id, evento_id)
);
create index inscricoes_evento on inscricoes (evento_id);

alter table empresas enable row level security;
alter table participantes enable row level security;
alter table eventos enable row level security;
alter table inscricoes enable row level security;
```

Confira pelo MCP (`list_tables`): devem existir as quatro tabelas `empresas`, `participantes`, `eventos` e `inscricoes`, todas com `rls_enabled: true`. Rode também os *advisors* de segurança do MCP. O aviso "RLS enabled, no policy" é **esperado e intencional**; qualquer outro aviso deve ser reportado.

- [ ] **Passo 8: Verificar e commitar.**

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit -p .; & .\node_modules\.bin\eslint.cmd src; & .\node_modules\.bin\vitest.cmd run
git add -A; git commit -m "Cria projeto Next, migração do banco e cliente do Supabase (#<issue>)"
```

---

### Tarefa 2: Regras de domínio — CPF, busca, código do QR e schemas

**Arquivos:**
- Criar: `src/lib/documento.ts`, `src/lib/texto.ts`, `src/lib/codigo.ts`, `src/lib/dominio.ts`, `src/lib/acao.ts`
- Teste: `src/lib/documento.test.ts`, `src/lib/texto.test.ts`, `src/lib/dominio.test.ts`, `src/lib/acao.test.ts`

**Interfaces:**
- Produz:
  - `normalizarDocumento(v)`, `cpfValido(cpf)`, `validarDocumento(v): {ok:true;documento}|{ok:false;erro}`;
  - `semAcento`, `normalizarBusca`, `limparTermo`, `escaparHtml`;
  - `gerarCodigo(): string`, com 22 caracteres;
  - `TIPOS_PARTICIPANTE`, `TIPOS_EVENTO`, `TipoParticipante`, `TipoEvento`, `lerTipoParticipante`, `ehUuid`, `dataIsoValida`, `formatarData`;
  - `participanteSchema`, `ParticipanteInput`, `eventoSchema`, `EventoInput`, `empresaSchema`;
  - `EstadoAcao`, `estadoInicial`, `valoresDo(form)`, `errosDoZod(erro, valores)`.

- [ ] **Passo 1: Escrever os testes que falham:**

```ts
import { describe, expect, it } from "vitest";
import { cpfValido, normalizarDocumento, validarDocumento } from "./documento";

describe("normalizarDocumento", () => {
  it("tira pontuação e põe em caixa alta", () => {
    expect(normalizarDocumento("529.982.247-25")).toBe("52998224725");
    expect(normalizarDocumento(" fx-123 456 ")).toBe("FX123456");
  });
});

describe("cpfValido", () => {
  it("aceita CPF com verificadores certos", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("11144477735")).toBe(true);
  });
  it("aceita CPF que começa com zero", () => {
    expect(cpfValido("01234567890")).toBe(true);
  });
  it("recusa verificador errado e sequência repetida", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
});

describe("validarDocumento", () => {
  it("11 dígitos inválidos = CPF inválido", () => {
    expect(validarDocumento("529.982.247-24")).toEqual({ ok: false, erro: "CPF inválido" });
  });
  it("passaporte passa como veio", () => {
    expect(validarDocumento("FX123456")).toEqual({ ok: true, documento: "FX123456" });
  });
  it("vazio é obrigatório", () => {
    expect(validarDocumento(" .- ")).toEqual({ ok: false, erro: "Documento obrigatório" });
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { gerarCodigo } from "./codigo";
import { escaparHtml, limparTermo, normalizarBusca } from "./texto";

describe("normalizarBusca", () => {
  it("tira acento, caixa e espaço sobrando", () => {
    expect(normalizarBusca("  JOSÉ   Conceição ")).toBe("jose conceicao");
  });
});

describe("limparTermo", () => {
  it("remove o que quebraria o filtro .or() do PostgREST", () => {
    expect(limparTermo("ana,(silva)%*")).toBe("ana silva");
  });
});

describe("escaparHtml", () => {
  it("neutraliza tag no nome", () => {
    expect(escaparHtml('<b>Ana</b> & "Bia"')).toBe("&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Bia&quot;");
  });
});

describe("gerarCodigo", () => {
  it("gera 22 caracteres base64url, diferentes a cada chamada", () => {
    const a = gerarCodigo();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(gerarCodigo()).not.toBe(a);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { dataIsoValida, ehUuid, eventoSchema, formatarData, lerTipoParticipante, participanteSchema } from "./dominio";

describe("lerTipoParticipante", () => {
  it("aceita plural, caixa e acento", () => {
    expect(lerTipoParticipante("Palestrantes")).toBe("palestrante");
    expect(lerTipoParticipante("VIP")).toBe("vip");
    expect(lerTipoParticipante(" autoridades ")).toBe("autoridade");
    expect(lerTipoParticipante("Imprensa")).toBeNull();
  });
});

describe("dataIsoValida", () => {
  it("recusa dia que não existe", () => {
    expect(dataIsoValida("2026-02-28")).toBe(true);
    expect(dataIsoValida("2026-02-31")).toBe(false);
    expect(dataIsoValida("17/05/1990")).toBe(false);
  });
});

describe("participanteSchema", () => {
  it("normaliza e transforma campo vazio em null", () => {
    const r = participanteSchema.parse({
      nome: "  Maria   da Silva ",
      documento: "529.982.247-25",
      data_nascimento: "",
      email: "",
      telefone: " ",
      tipo: "vip",
    });
    expect(r).toEqual({
      nome: "Maria da Silva",
      documento: "52998224725",
      data_nascimento: null,
      email: null,
      telefone: null,
      tipo: "vip",
    });
  });
  it("junta as mensagens de erro", () => {
    const r = participanteSchema.safeParse({
      nome: "",
      documento: "111.111.111-11",
      data_nascimento: "1990-13-01",
      email: "nao-e-email",
      telefone: "",
      tipo: "imprensa",
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).sort()).toEqual(
      ["CPF inválido", "Data de nascimento inválida", "E-mail inválido", "Nome obrigatório", "Tipo inválido"].sort(),
    );
  });
});

describe("formatarData", () => {
  it("formata sem deslocar o dia", () => {
    expect(formatarData("2027-01-15")).toBe("15/01/2027");
    expect(formatarData("2026-10-05T23:30:00-03:00")).toBe("05/10/2026");
    expect(formatarData(null)).toBe("");
  });
});

describe("ehUuid", () => {
  it("aceita uuid e recusa o resto", () => {
    expect(ehUuid("3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f")).toBe(true);
    expect(ehUuid("nao-uuid")).toBe(false);
  });
});

describe("eventoSchema", () => {
  it("exige data real", () => {
    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "2027-01-15" }).success).toBe(true);
    expect(eventoSchema.safeParse({ nome: "Kickoff 2027", tipo: "kickoff", data: "" }).success).toBe(false);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { empresaSchema } from "./dominio";
import { errosDoZod, valoresDo } from "./acao";

describe("valoresDo", () => {
  it("pega só os campos de texto do form", () => {
    const form = new FormData();
    form.set("nome", "Acme");
    form.set("arquivo", new Blob(["x"]));
    expect(valoresDo(form)).toEqual({ nome: "Acme" });
  });
});

describe("errosDoZod", () => {
  it("agrupa a mensagem por campo e devolve o que foi digitado", () => {
    const r = empresaSchema.safeParse({ nome: "  " });
    expect(r.success).toBe(false);
    expect(errosDoZod(r.error!, { nome: "  " })).toEqual({
      ok: false,
      mensagem: "Corrija os campos destacados",
      erros: { nome: ["Nome obrigatório"] },
      valores: { nome: "  " },
    });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar.** `& .\node_modules\.bin\vitest.cmd run src/lib`. Esperado: FAIL, porque os módulos não existem.

- [ ] **Passo 3: Implementar:**

```ts
export function normalizarDocumento(valor: string): string {
  return valor.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

export type ResultadoDocumento = { ok: true; documento: string } | { ok: false; erro: string };

// 11 dígitos = CPF e confere os verificadores; qualquer outra coisa (passaporte) passa como veio.
export function validarDocumento(valor: string): ResultadoDocumento {
  const documento = normalizarDocumento(valor);
  if (!documento) return { ok: false, erro: "Documento obrigatório" };
  if (/^\d{11}$/.test(documento) && !cpfValido(documento)) return { ok: false, erro: "CPF inválido" };
  return { ok: true, documento };
}
```

```ts
export function semAcento(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Guardado em nome_busca: a busca compara sem acento e sem caixa.
export function normalizarBusca(valor: string): string {
  return semAcento(valor).toLowerCase().replace(/\s+/g, " ").trim();
}

// Nome de participante entra no HTML do e-mail.
export function escaparHtml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Tira o que quebra a sintaxe do filtro .or() do PostgREST e os curingas do ilike.
export function limparTermo(valor: string): string {
  return normalizarBusca(valor).replace(/[,()%*\\:"]/g, " ").replace(/\s+/g, " ").trim();
}
```

```ts
import { randomBytes } from "node:crypto";

// 128 bits aleatórios, 22 caracteres base64url. É o que vai no QR.
export function gerarCodigo(): string {
  return randomBytes(16).toString("base64url");
}
```

```ts
import { z } from "zod";
import { validarDocumento } from "./documento";
import { semAcento } from "./texto";

export const TIPOS_PARTICIPANTE = {
  palestrante: "Palestrante",
  vip: "VIP",
  autoridade: "Autoridade",
  convidado: "Convidado",
} as const;
export type TipoParticipante = keyof typeof TIPOS_PARTICIPANTE;

export const TIPOS_EVENTO = {
  palestra: "Palestra",
  workshop: "Workshop",
  treinamento: "Treinamento",
  kickoff: "Kickoff",
  lancamento: "Lançamento",
  premiacao_incentivo: "Premiação e incentivo",
  demonstracao_produto: "Demonstração de produto",
  feedback: "Feedback",
} as const;
export type TipoEvento = keyof typeof TIPOS_EVENTO;

// Aceita "Palestrantes", "vip", "AUTORIDADES", "Convidado".
export function lerTipoParticipante(valor: string): TipoParticipante | null {
  const chave = semAcento(valor).toLowerCase().trim().replace(/s$/, "");
  return chave in TIPOS_PARTICIPANTE ? (chave as TipoParticipante) : null;
}

// id que vem da URL: sem isso um id torto vira erro 22P02 do Postgres em vez de 404.
export function ehUuid(valor: string): boolean {
  return z.uuid().safeParse(valor).success;
}

// "2026-02-31" casa com a regex mas não existe; o round-trip pelo Date pega isso.
export function dataIsoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

// "2027-01-15" -> "15/01/2027", sem passar por Date (que desloca o dia pelo fuso).
export function formatarData(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const textoOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const participanteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").transform((v) => v.replace(/\s+/g, " ")),
  documento: z.string().transform((v, ctx) => {
    const r = validarDocumento(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.erro });
      return z.NEVER;
    }
    return r.documento;
  }),
  data_nascimento: textoOpcional.refine((v) => v === null || dataIsoValida(v), "Data de nascimento inválida"),
  email: textoOpcional.refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido"),
  telefone: textoOpcional,
  tipo: z.enum(Object.keys(TIPOS_PARTICIPANTE) as [TipoParticipante, ...TipoParticipante[]], { message: "Tipo inválido" }),
});
export type ParticipanteInput = z.output<typeof participanteSchema>;

export const eventoSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  tipo: z.enum(Object.keys(TIPOS_EVENTO) as [TipoEvento, ...TipoEvento[]], { message: "Tipo inválido" }),
  data: z.string().refine(dataIsoValida, "Data inválida"),
});
export type EventoInput = z.output<typeof eventoSchema>;

export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").transform((v) => v.replace(/\s+/g, " ")),
});
```

```ts
import { z } from "zod";

// Estado devolvido pelas Server Actions de formulário (useActionState).
// `valores` volta o que foi digitado: o React 19 limpa o form depois da action, e o
// defaultValue lido daqui é o que repõe os campos quando há erro.
export type EstadoAcao = {
  ok: boolean;
  mensagem: string;
  erros?: Record<string, string[] | undefined>;
  valores?: Record<string, string>;
};

export const estadoInicial: EstadoAcao = { ok: true, mensagem: "" };

export function valoresDo(form: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of form.entries()) if (typeof valor === "string") valores[chave] = valor;
  return valores;
}

export function errosDoZod(erro: z.ZodError, valores: Record<string, string>): EstadoAcao {
  return {
    ok: false,
    mensagem: "Corrija os campos destacados",
    erros: z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>,
    valores,
  };
}
```

- [ ] **Passo 4: Rodar e ver passar.** Esperado: 3 (erros) + 7 (documento) + 4 (texto) + 7 (dominio) + 2 (acao) = **23 testes passando**.

- [ ] **Passo 5: Commitar.** `git commit -m "Adiciona regras de CPF, busca, código do QR e schemas (#<issue>)"`

---

### Tarefa 3: Direção visual, casca do app e CRUD de empresas

**Arquivos:**
- Criar: `components.json` e `src/components/ui/*` (gerados pelo shadcn), `src/components/campo.tsx`, `src/components/botao-apagar.tsx`
- Criar: `src/app/empresas/actions.ts`, `src/app/empresas/formulario.tsx`, `src/app/empresas/page.tsx`, `src/app/empresas/novo/page.tsx`, `src/app/empresas/[id]/page.tsx`
- Modificar: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consome: `db`, `mensagemErro`, `empresaSchema`, `limparTermo`, `ehUuid`, `EstadoAcao`, `estadoInicial`, `valoresDo`, `errosDoZod`.
- Produz:
  - `<Campo nome rotulo erros? …inputProps>` e `<Selecao nome rotulo opcoes vazio? erros? …selectProps>`;
  - `<BotaoApagar acao confirmacao rotulo?>`;
  - `salvarEmpresa(estado, form)` e `apagarEmpresa(id)`;
  - o layout com o menu Eventos · Participantes · Empresas · Check-in.

- [ ] **Passo 1: Direção visual.** Rode as cinco skills obrigatórias nesta ordem e registre a direção escolhida (paleta, tipo, densidade, tom) no `IMPLEMENTACAO.md`:
  1. `taste-skill`;
  2. `refero`: busque telas reais de "event check-in", "attendee management" e "CRM table", e **olhe as imagens** com `refero_get_screen_image`;
  3. `emil-design-eng`;
  4. `impeccable`;
  5. 21st.dev.

  O produto é uma ferramenta interna de operação de evento: densa, legível, rápida no celular. Não é landing page. A tela de check-in é a mais crítica: é usada em pé, na fila, com uma mão.

- [ ] **Passo 2: shadcn.**

```powershell
npx --yes shadcn@latest init -d
npx --yes shadcn@latest add button input label table sonner badge card -y
```

Esperado: `components.json` com `"style": "base-nova"` e os componentes em `src/components/ui/`. O `init` instala um pacote chamado `cn`, que é o que `src/lib/utils.ts` usa, e não um engano. Leia os arquivos gerados antes de usá-los: a API é a do Base UI.

- [ ] **Passo 3: Casca e componentes.** O layout tira o Geist que o gerador põe. A fonte sai da direção do passo 1.

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = { title: "CRM de eventos" };

// Toda tela lê o banco na hora; nada é pré-renderizado no build.
export const dynamic = "force-dynamic";

const MENU = [
  ["/eventos", "Eventos"],
  ["/participantes", "Participantes"],
  ["/empresas", "Empresas"],
  ["/checkin", "Check-in"],
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <header className="border-b">
          <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 py-3 text-sm font-medium">
            {MENU.map(([href, texto]) => (
              <Link key={href} href={href} className="whitespace-nowrap hover:underline">
                {texto}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Toaster richColors />
      </body>
    </html>
  );
}
```

```tsx
import { redirect } from "next/navigation";

export default function Inicio() {
  redirect("/eventos");
}
```

```tsx
import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Base = { nome: string; rotulo: string; erros?: string[] };

function Moldura({ nome, rotulo, erros, children }: Base & { children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={nome}>{rotulo}</Label>
      {children}
      {erros?.map((e) => (
        <p key={e} id={`${nome}-erro`} className="text-sm text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}

export function Campo({ nome, rotulo, erros, ...props }: Base & ComponentProps<typeof Input>) {
  return (
    <Moldura nome={nome} rotulo={rotulo} erros={erros}>
      <Input id={nome} name={nome} aria-invalid={erros ? true : undefined} aria-describedby={erros ? `${nome}-erro` : undefined} {...props} />
    </Moldura>
  );
}

// <select> nativo: acessível, funciona no celular e dispensa o Select do Base UI.
export function Selecao({
  nome,
  rotulo,
  erros,
  opcoes,
  vazio,
  ...props
}: Base & { opcoes: Record<string, string>; vazio?: string } & ComponentProps<"select">) {
  return (
    <Moldura nome={nome} rotulo={rotulo} erros={erros}>
      <select
        id={nome}
        name={nome}
        aria-invalid={erros ? true : undefined}
        className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...props}
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {Object.entries(opcoes).map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </Moldura>
  );
}
```

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EstadoAcao } from "@/lib/acao";

export function BotaoApagar({ acao, confirmacao, rotulo = "Apagar" }: { acao: () => Promise<EstadoAcao>; confirmacao: string; rotulo?: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pendente}
      onClick={() => {
        if (!window.confirm(confirmacao)) return;
        iniciar(async () => {
          const r = await acao();
          if (r.ok) toast.success(r.mensagem);
          else toast.error(r.mensagem);
        });
      }}
    >
      {rotulo}
    </Button>
  );
}
```

- [ ] **Passo 4: Empresas.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { empresaSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarEmpresa(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = empresaSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const { error } = valores.id
    ? await db().from("empresas").update(r.data).eq("id", valores.id)
    : await db().from("empresas").insert(r.data);
  if (error) return { ok: false, mensagem: mensagemErro(error, "Já existe uma empresa com esse nome"), valores };
  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function apagarEmpresa(id: string): Promise<EstadoAcao> {
  const { error } = await db().from("empresas").delete().eq("id", id);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath("/empresas");
  return { ok: true, mensagem: "Empresa apagada" };
}
```

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { salvarEmpresa } from "./actions";

export function FormularioEmpresa({ empresa }: { empresa?: { id: string; nome: string } }) {
  const [estado, acao, pendente] = useActionState(salvarEmpresa, estadoInicial);
  return (
    <form action={acao} className="grid max-w-md gap-4">
      {empresa && <input type="hidden" name="id" value={empresa.id} />}
      <Campo nome="nome" rotulo="Nome" defaultValue={estado.valores?.nome ?? empresa?.nome} erros={estado.erros?.nome} required />
      {!estado.ok && !estado.erros && <p className="text-sm text-destructive">{estado.mensagem}</p>}
      <Button type="submit" disabled={pendente} className="justify-self-start">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
```

```tsx
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <Link href="/empresas/novo" className={buttonVariants()}>Nova empresa</Link>
      </div>
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
    </section>
  );
}
```

```tsx
import { FormularioEmpresa } from "../formulario";

export default function NovaEmpresa() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Nova empresa</h1>
      <FormularioEmpresa />
    </section>
  );
}
```

```tsx
import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { FormularioEmpresa } from "../formulario";

export default async function EditarEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data } = await db().from("empresas").select("id, nome").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Editar empresa</h1>
      <FormularioEmpresa empresa={data} />
    </section>
  );
}
```

- [ ] **Passo 5: Ver rodando.** Rode `npm run dev` com `.env.local` apontando para o Supabase. Depois verifique pelo Playwright MCP, em 1440 e 390:
  - criar "Acme";
  - criar "ACME", que deve mostrar "Já existe uma empresa com esse nome";
  - editar a empresa;
  - apagar a empresa;
  - abrir `/empresas/nao-uuid`, que deve dar 404.

  Tire screenshot de cada estado e confira o console sem erro. Aplique a direção do passo 1 até a tela passar no `impeccable`.

- [ ] **Passo 6: Verificar e commitar.** Rode `tsc`, `eslint` e `vitest` limpos. Depois `git commit -m "Adiciona casca do app e cadastro de empresas (#<issue>)"`.

---

### Tarefa 4: CRUD de participantes com busca por nome e CPF

**Arquivos:**
- Criar: `src/lib/busca.ts`, `src/app/participantes/actions.ts`, `src/app/participantes/formulario.tsx`, `src/app/participantes/page.tsx`, `src/app/participantes/novo/page.tsx`, `src/app/participantes/[id]/page.tsx`

**Interfaces:**
- Consome: Tarefas 1 a 3.
- Produz:
  - `buscarParticipantes({ termo?, empresaId?, tipo?, limite? }): Promise<ParticipanteListado[]>`;
  - `listarEmpresas(): Promise<{id; nome}[]>`;
  - `salvarParticipante`, `apagarParticipante(id)`.

- [ ] **Passo 1: Busca.** Uma função só serve a lista, a tela de inscrever (Tarefa 6) e a busca do check-in (Tarefa 8):

```ts
import "server-only";
import { z } from "zod";
import { db } from "./supabase";
import { normalizarDocumento } from "./documento";
import { limparTermo } from "./texto";
import { TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";

export type ParticipanteListado = {
  id: string;
  nome: string;
  documento: string;
  email: string | null;
  telefone: string | null;
  tipo: TipoParticipante;
  empresa: { id: string; nome: string } | null;
};

export type FiltroParticipantes = { termo?: string; empresaId?: string; tipo?: string; limite?: number };

// Usada pela lista de participantes, pela tela de inscrever e pela busca manual do check-in.
// ponytail: limite fixo sem paginação; a tela pede para refinar a busca quando bate no limite.
export async function buscarParticipantes(f: FiltroParticipantes): Promise<ParticipanteListado[]> {
  let q = db()
    .from("participantes")
    .select("id, nome, documento, email, telefone, tipo, empresa:empresas(id, nome)")
    .order("nome_busca")
    .limit(f.limite ?? 200);
  const termo = limparTermo(f.termo ?? "");
  const documento = normalizarDocumento(f.termo ?? "");
  if (termo) {
    q = documento.length >= 3
      ? q.or(`nome_busca.ilike.%${termo}%,documento.ilike.%${documento}%`)
      : q.ilike("nome_busca", `%${termo}%`);
  }
  // Valor fora do domínio viraria erro de cast no Postgres; é ignorado.
  if (f.empresaId && z.uuid().safeParse(f.empresaId).success) q = q.eq("empresa_id", f.empresaId);
  if (f.tipo && f.tipo in TIPOS_PARTICIPANTE) q = q.eq("tipo", f.tipo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as unknown as ParticipanteListado[];
}

export async function listarEmpresas(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await db().from("empresas").select("id, nome").order("nome");
  if (error) throw new Error(error.message);
  return data;
}
```

- [ ] **Passo 2: Actions e telas.** A mensagem de documento duplicado diz **de quem** é o documento, como a spec pede.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { participanteSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { normalizarBusca } from "@/lib/texto";
import { errosDoZod, valoresDo, type EstadoAcao } from "@/lib/acao";

export async function salvarParticipante(_anterior: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const valores = valoresDo(form);
  const r = participanteSchema.safeParse(valores);
  if (!r.success) return errosDoZod(r.error, valores);
  const linha = { ...r.data, nome_busca: normalizarBusca(r.data.nome), empresa_id: valores.empresa_id || null };
  const { error } = valores.id
    ? await db().from("participantes").update(linha).eq("id", valores.id)
    : await db().from("participantes").insert(linha);
  if (error) {
    if (error.code === "23505") {
      const { data: dono } = await db().from("participantes").select("nome").eq("documento", r.data.documento).maybeSingle();
      return { ok: false, mensagem: "Documento já cadastrado", erros: { documento: [`Documento já cadastrado para ${dono?.nome ?? "outro participante"}`] }, valores };
    }
    return { ok: false, mensagem: mensagemErro(error), valores };
  }
  revalidatePath("/participantes");
  redirect("/participantes");
}

export async function apagarParticipante(id: string): Promise<EstadoAcao> {
  const { error } = await db().from("participantes").delete().eq("id", id);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath("/participantes");
  return { ok: true, mensagem: "Participante apagado" };
}
```

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
  empresa_id: string | null;
  tipo: string;
};

export function FormularioParticipante({ participante, empresas }: { participante?: ParticipanteEditavel; empresas: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState(salvarParticipante, estadoInicial);
  const v = (campo: keyof ParticipanteEditavel) => estado.valores?.[campo] ?? participante?.[campo] ?? "";
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="grid max-w-xl gap-4 sm:grid-cols-2">
      {participante && <input type="hidden" name="id" value={participante.id} />}
      <div className="sm:col-span-2">
        <Campo nome="nome" rotulo="Nome" defaultValue={v("nome")} erros={e.nome} required />
      </div>
      <Campo nome="documento" rotulo="CPF ou documento" defaultValue={v("documento")} erros={e.documento} required inputMode="text" />
      <Campo nome="data_nascimento" rotulo="Data de nascimento" type="date" defaultValue={v("data_nascimento")} erros={e.data_nascimento} />
      <Campo nome="email" rotulo="E-mail" type="email" defaultValue={v("email")} erros={e.email} />
      <Campo nome="telefone" rotulo="Telefone" type="tel" defaultValue={v("telefone")} erros={e.telefone} />
      <Selecao
        nome="empresa_id"
        rotulo="Empresa"
        vazio="Sem empresa"
        opcoes={Object.fromEntries(empresas.map((x) => [x.id, x.nome]))}
        defaultValue={v("empresa_id")}
      />
      <Selecao nome="tipo" rotulo="Tipo" opcoes={TIPOS_PARTICIPANTE} defaultValue={v("tipo") || "convidado"} erros={e.tipo} />
      {!estado.ok && !estado.erros && <p className="text-sm text-destructive sm:col-span-2">{estado.mensagem}</p>}
      <Button type="submit" disabled={pendente} className="justify-self-start">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
```

```tsx
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { buscarParticipantes, listarEmpresas } from "@/lib/busca";
import { TIPOS_PARTICIPANTE } from "@/lib/dominio";
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
        <h1 className="text-2xl font-semibold">Participantes</h1>
        <div className="flex gap-2">
          <Link href="/participantes/importar" className={buttonVariants({ variant: "outline" })}>Importar planilha</Link>
          <Link href="/participantes/novo" className={buttonVariants()}>Novo participante</Link>
        </div>
      </div>

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
                <Link href={`/participantes/${p.id}`} className="hover:underline">{p.nome}</Link>
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
    </section>
  );
}
```

```tsx
import { listarEmpresas } from "@/lib/busca";
import { FormularioParticipante } from "../formulario";

export default async function NovoParticipante() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo participante</h1>
      <FormularioParticipante empresas={await listarEmpresas()} />
    </section>
  );
}
```

```tsx
import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { listarEmpresas } from "@/lib/busca";
import { FormularioParticipante, type ParticipanteEditavel } from "../formulario";

export default async function EditarParticipante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const [{ data }, empresas] = await Promise.all([
    db().from("participantes").select("id, nome, documento, data_nascimento, email, telefone, empresa_id, tipo").eq("id", id).maybeSingle(),
    listarEmpresas(),
  ]);
  if (!data) notFound();
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Editar participante</h1>
      <FormularioParticipante participante={data as ParticipanteEditavel} empresas={empresas} />
    </section>
  );
}
```

- [ ] **Passo 3: Ver rodando** pelo Playwright MCP, em 1440 e 390:
  - cadastrar "José Conceição" com CPF válido;
  - buscar por "jose conceicao" (sem acento) e por "529.982" (com ponto);
  - cadastrar outro com o mesmo CPF, que deve mostrar "Documento já cadastrado para José Conceição";
  - cadastrar com CPF "111.111.111-11", que deve mostrar "CPF inválido";
  - buscar `ana,(silva)%`, que não pode dar erro;
  - filtrar por empresa e por tipo;
  - tentar apagar uma empresa que tem participante, que deve mostrar a mensagem "Não dá para apagar".

  Screenshot de cada estado.

- [ ] **Passo 4: Verificar e commitar.** `git commit -m "Adiciona cadastro e busca de participantes (#<issue>)"`

---

### Tarefa 5: Credencial em PDF e ZIP do evento

**Arquivos:**
- Criar: `src/lib/pdf.ts`, `src/lib/zip.ts`, `src/lib/credencial.ts`, `src/app/inscricoes/[id]/pdf/route.ts`, `src/app/eventos/[id]/zip/route.ts`
- Teste: `src/lib/pdf.test.ts`

**Interfaces:**
- Produz:
  - `DadosCredencial`, `gerarCredencialPdf(d): Promise<Uint8Array>`, `textoSeguro(fonte, texto)`;
  - `nomeArquivo(nome)`, `montarZip(arquivos)`;
  - `Credencial`, `carregarCredenciais({ids} | {eventoId}): Promise<Credencial[]>`;
  - as rotas `GET /inscricoes/[id]/pdf` e `GET /eventos/[id]/zip`.

- [ ] **Passo 1: Escrever o teste que falha:**

```ts
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import { gerarCredencialPdf } from "./pdf";
import { montarZip, nomeArquivo } from "./zip";

const dados = { nome: "José Conceição", tipo: "VIP", empresa: "Acme", evento: "Kickoff 2027", data: "15/01/2027", codigo: "AbCdEfGhIjKlMnOpQrStUv" };

describe("gerarCredencialPdf", () => {
  it("gera um PDF de uma página A4", async () => {
    const doc = await PDFDocument.load(await gerarCredencialPdf(dados));
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });

  it("não quebra com letra fora do WinAnsi, nome enorme e sem empresa", async () => {
    const bytes = await gerarCredencialPdf({ ...dados, nome: "Łukasz Żółć 李 " + "Muito ".repeat(30), empresa: null });
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

- [ ] **Passo 2: Rodar e ver falhar.** Esperado: FAIL, porque `./pdf` não existe.

- [ ] **Passo 3: Implementar.** A Helvetica padrão do PDF só codifica WinAnsi, que cobre o português. `textoSeguro` troca o resto, para um nome polonês ou chinês não derrubar a geração.

```ts
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

export type DadosCredencial = {
  nome: string;
  tipo: string; // rótulo já legível: "VIP", "Palestrante"
  empresa: string | null;
  evento: string;
  data: string; // "17/05/2026"
  codigo: string;
};

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

// Diminui a fonte até caber na largura; nome comprido não vaza da página.
function tamanhoQueCabe(fonte: PDFFont, texto: string, maximo: number, largura: number): number {
  let tamanho = maximo;
  while (tamanho > 10 && fonte.widthOfTextAtSize(texto, tamanho) > largura) tamanho -= 1;
  return tamanho;
}

export async function gerarCredencialPdf(d: DadosCredencial): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595.28, 841.89]); // A4 em pontos
  const { width, height } = pagina.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margem = 56;
  const larguraUtil = width - margem * 2;

  const centro = (texto: string, fonte: PDFFont, tamanho: number, y: number, cor = rgb(0.1, 0.1, 0.1)) => {
    const t = textoSeguro(fonte, texto);
    const s = tamanhoQueCabe(fonte, t, tamanho, larguraUtil);
    pagina.drawText(t, { x: (width - fonte.widthOfTextAtSize(t, s)) / 2, y, size: s, font: fonte, color: cor });
  };

  centro(d.evento, negrito, 20, height - 90);
  centro(d.data, regular, 13, height - 112, rgb(0.4, 0.4, 0.4));

  const png = await QRCode.toBuffer(d.codigo, { errorCorrectionLevel: "M", margin: 1, width: 600 });
  const qr = await pdf.embedPng(png);
  const lado = 300;
  pagina.drawImage(qr, { x: (width - lado) / 2, y: height - 170 - lado, width: lado, height: lado });

  centro(d.nome, negrito, 30, height - 530);
  centro(d.tipo.toUpperCase(), negrito, 16, height - 565, rgb(0.35, 0.35, 0.35));
  if (d.empresa) centro(d.empresa, regular, 16, height - 592);
  centro("Apresente este QR code na entrada do evento.", regular, 11, 60, rgb(0.45, 0.45, 0.45));

  return pdf.save();
}
```

```ts
import { zipSync } from "fflate";
import { semAcento } from "./texto";

export function nomeArquivo(nome: string): string {
  const base = semAcento(nome).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return base || "participante";
}

// Dois "João Silva" no mesmo evento viram joao-silva.pdf e joao-silva-2.pdf.
export function montarZip(arquivos: { nome: string; conteudo: Uint8Array }[]): Uint8Array {
  const usados = new Map<string, number>();
  const entradas: Record<string, Uint8Array> = {};
  for (const a of arquivos) {
    const base = nomeArquivo(a.nome);
    const n = (usados.get(base) ?? 0) + 1;
    usados.set(base, n);
    entradas[n === 1 ? `${base}.pdf` : `${base}-${n}.pdf`] = a.conteudo;
  }
  // PDF já é comprimido; level 0 só empacota.
  return zipSync(entradas, { level: 0 });
}
```

```ts
import "server-only";
import { db } from "./supabase";
import { formatarData, TIPOS_PARTICIPANTE, type TipoParticipante } from "./dominio";
import type { DadosCredencial } from "./pdf";

export type Credencial = DadosCredencial & { inscricaoId: string; email: string | null };

type Linha = {
  id: string;
  codigo: string;
  participante: { nome: string; tipo: TipoParticipante; email: string | null; empresa: { nome: string } | null };
  evento: { nome: string; data: string };
};

const CAMPOS = "id, codigo, participante:participantes(nome, tipo, email, empresa:empresas(nome)), evento:eventos(nome, data)";

// Fonte única dos dados que vão no PDF: rota do PDF, ZIP do evento e e-mail.
export async function carregarCredenciais(filtro: { ids: string[] } | { eventoId: string }): Promise<Credencial[]> {
  const base = db().from("inscricoes").select(CAMPOS);
  const { data, error } = await ("ids" in filtro ? base.in("id", filtro.ids) : base.eq("evento_id", filtro.eventoId));
  if (error) throw new Error(error.message);
  return (data as unknown as Linha[])
    .map((l) => ({
      inscricaoId: l.id,
      email: l.participante.email,
      nome: l.participante.nome,
      tipo: TIPOS_PARTICIPANTE[l.participante.tipo],
      empresa: l.participante.empresa?.nome ?? null,
      evento: l.evento.nome,
      data: formatarData(l.evento.data),
      codigo: l.codigo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
```

```ts
import { z } from "zod";
import { carregarCredenciais } from "@/lib/credencial";
import { gerarCredencialPdf } from "@/lib/pdf";
import { nomeArquivo } from "@/lib/zip";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Inscrição não encontrada", { status: 404 });
  const [c] = await carregarCredenciais({ ids: [id] });
  if (!c) return new Response("Inscrição não encontrada", { status: 404 });
  return new Response(Buffer.from(await gerarCredencialPdf(c)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo(c.nome)}.pdf"`,
    },
  });
}
```

```ts
import { ehUuid } from "@/lib/dominio";
import { carregarCredenciais } from "@/lib/credencial";
import { gerarCredencialPdf } from "@/lib/pdf";
import { montarZip, nomeArquivo } from "@/lib/zip";
import { db } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return new Response("Evento não encontrado", { status: 404 });
  const { data: evento } = await db().from("eventos").select("nome").eq("id", id).maybeSingle();
  if (!evento) return new Response("Evento não encontrado", { status: 404 });
  const credenciais = await carregarCredenciais({ eventoId: id });
  if (credenciais.length === 0) return new Response("Nenhum inscrito neste evento", { status: 404 });
  const arquivos = [];
  for (const c of credenciais) arquivos.push({ nome: c.nome, conteudo: await gerarCredencialPdf(c) });
  return new Response(Buffer.from(montarZip(arquivos)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeArquivo(evento.nome)}.zip"`,
    },
  });
}
```

- [ ] **Passo 4: Rodar e ver passar.** Esperado: 23 + 4 = **27 testes**. Gere um PDF de exemplo com `gerarCredencialPdf`, abra o arquivo e leia o QR com a câmera de um celular: o texto lido deve ser o código. Registre o resultado no `IMPLEMENTACAO.md`.

- [ ] **Passo 5: Commitar.** `git commit -m "Adiciona credencial em PDF com QR e ZIP do evento (#<issue>)"`

---

### Tarefa 6: Eventos e inscrições

**Arquivos:**
- Criar: `src/app/eventos/actions.ts`, `src/app/eventos/formulario.tsx`, `src/app/eventos/page.tsx`, `src/app/eventos/novo/page.tsx`, `src/app/eventos/[id]/page.tsx`, `src/app/eventos/[id]/editar/page.tsx`, `src/app/eventos/[id]/inscrever/page.tsx`

**Interfaces:**
- Consome: `buscarParticipantes` (Tarefa 4), `gerarCodigo` (Tarefa 2) e as rotas de PDF e ZIP (Tarefa 5).
- Produz: `salvarEvento`, `apagarEvento(id)`, `inscreverSelecionados(form)`, `removerInscricao(inscricaoId, eventoId)`; a página do evento com contador `presentes/inscritos` (`aria-label="Presentes sobre inscritos"`) e o código de cada inscrição em `.font-mono`, que o E2E lê.

- [ ] **Passo 1: Actions e formulário.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { eventoSchema } from "@/lib/dominio";
import { mensagemErro } from "@/lib/erros";
import { gerarCodigo } from "@/lib/codigo";
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

// Form da tela "Inscrever": checkboxes name="participante". Já inscrito é ignorado (ignoreDuplicates).
export async function inscreverSelecionados(form: FormData): Promise<void> {
  const eventoId = String(form.get("evento_id"));
  const ids = form.getAll("participante").map(String);
  if (ids.length) {
    const { error } = await db()
      .from("inscricoes")
      .upsert(ids.map((id) => ({ participante_id: id, evento_id: eventoId, codigo: gerarCodigo() })), {
        onConflict: "participante_id,evento_id",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/eventos/${eventoId}`);
  redirect(`/eventos/${eventoId}`);
}

export async function removerInscricao(inscricaoId: string, eventoId: string): Promise<EstadoAcao> {
  const { error } = await db().from("inscricoes").delete().eq("id", inscricaoId);
  if (error) return { ok: false, mensagem: mensagemErro(error) };
  revalidatePath(`/eventos/${eventoId}`);
  return { ok: true, mensagem: "Inscrição removida" };
}
```

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Selecao } from "@/components/campo";
import { estadoInicial } from "@/lib/acao";
import { TIPOS_EVENTO } from "@/lib/dominio";
import { salvarEvento } from "./actions";

export function FormularioEvento({ evento }: { evento?: { id: string; nome: string; tipo: string; data: string } }) {
  const [estado, acao, pendente] = useActionState(salvarEvento, estadoInicial);
  const e = estado.erros ?? {};
  return (
    <form action={acao} className="grid max-w-md gap-4">
      {evento && <input type="hidden" name="id" value={evento.id} />}
      <Campo nome="nome" rotulo="Nome do evento" defaultValue={estado.valores?.nome ?? evento?.nome} erros={e.nome} required />
      <Selecao nome="tipo" rotulo="Tipo" opcoes={TIPOS_EVENTO} defaultValue={estado.valores?.tipo ?? evento?.tipo ?? "palestra"} erros={e.tipo} />
      <Campo nome="data" rotulo="Data" type="date" defaultValue={estado.valores?.data ?? evento?.data} erros={e.data} required />
      {!estado.ok && !estado.erros && <p className="text-sm text-destructive">{estado.mensagem}</p>}
      <Button type="submit" disabled={pendente} className="justify-self-start">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
```

- [ ] **Passo 2: Telas.** A página do evento entra aqui **sem** os botões de e-mail, que chegam na Tarefa 9. A coluna "E-mail" já mostra o estado gravado no banco.

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/supabase";
import { formatarData, TIPOS_EVENTO, type TipoEvento } from "@/lib/dominio";

export default async function Eventos() {
  const { data, error } = await db().from("eventos").select("id, nome, tipo, data, inscricoes(count)").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  const eventos = data as unknown as { id: string; nome: string; tipo: TipoEvento; data: string; inscricoes: { count: number }[] }[];

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Eventos</h1>
        <Link href="/eventos/novo" className={buttonVariants()}>Novo evento</Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Nome</TableHead>
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
              <TableCell>{TIPOS_EVENTO[e.tipo]}</TableCell>
              <TableCell className="text-right tabular-nums">{e.inscricoes[0]?.count ?? 0}</TableCell>
            </TableRow>
          ))}
          {eventos.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">Nenhum evento cadastrado.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
```

```tsx
import { FormularioEvento } from "../formulario";

export default function NovoEvento() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Novo evento</h1>
      <FormularioEvento />
    </section>
  );
}
```

`src/app/eventos/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { db } from "@/lib/supabase";
import { ehUuid, formatarData, TIPOS_EVENTO, TIPOS_PARTICIPANTE, type TipoEvento, type TipoParticipante } from "@/lib/dominio";
import { apagarEvento, removerInscricao } from "../actions";

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

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{evento.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {TIPOS_EVENTO[evento.tipo as TipoEvento]} · {formatarData(evento.data)}
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums" aria-label="Presentes sobre inscritos">
          {presentes}/{inscricoes.length}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/eventos/${id}/inscrever`} className={buttonVariants()}>Inscrever participantes</Link>
        <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
        <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
        <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todas as inscrições?`} rotulo="Apagar evento" />
      </div>

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
                {i.participante.nome}
                {i.participante.empresa && <span className="block text-xs text-muted-foreground">{i.participante.empresa.nome}</span>}
              </TableCell>
              <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[i.participante.tipo]}</Badge></TableCell>
              <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
              <TableCell className="tabular-nums">{i.checkin_em ? hora(i.checkin_em) : "—"}</TableCell>
              <TableCell className="text-xs">
                {i.email_enviado_em ? `Enviado ${hora(i.email_enviado_em)}` : i.email_erro ? <span className="text-destructive">{i.email_erro}</span> : i.participante.email ? "Não enviado" : "Sem e-mail"}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <a href={`/inscricoes/${i.id}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>PDF</a>
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
    </section>
  );
}
```

```tsx
import { ehUuid } from "@/lib/dominio";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { FormularioEvento } from "../../formulario";

export default async function EditarEvento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { data } = await db().from("eventos").select("id, nome, tipo, data").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Editar evento</h1>
      <FormularioEvento evento={data} />
    </section>
  );
}
```

```tsx
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/supabase";
import { buscarParticipantes } from "@/lib/busca";
import { ehUuid, TIPOS_PARTICIPANTE } from "@/lib/dominio";
import { inscreverSelecionados } from "../../actions";

export default async function Inscrever({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const { q = "" } = await searchParams;
  const [{ data: evento }, { data: jaInscritos }, participantes] = await Promise.all([
    db().from("eventos").select("id, nome").eq("id", id).maybeSingle(),
    db().from("inscricoes").select("participante_id").eq("evento_id", id),
    buscarParticipantes({ termo: q, limite: 500 }),
  ]);
  if (!evento) notFound();
  const inscritos = new Set((jaInscritos ?? []).map((i) => i.participante_id as string));

  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Inscrever em {evento.nome}</h1>
      <form className="flex max-w-md gap-2">
        <Input name="q" defaultValue={q} placeholder="Nome ou CPF" aria-label="Buscar participante" />
        <Button type="submit" variant="outline">Buscar</Button>
      </form>
      <form action={inscreverSelecionados} className="grid gap-3">
        <input type="hidden" name="evento_id" value={id} />
        <ul className="grid gap-1">
          {participantes.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                <input type="checkbox" name="participante" value={p.id} disabled={inscritos.has(p.id)} defaultChecked={inscritos.has(p.id)} className="size-4" />
                <span>{p.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {TIPOS_PARTICIPANTE[p.tipo]}{p.empresa ? ` · ${p.empresa.nome}` : ""}{inscritos.has(p.id) ? " · já inscrito" : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Button type="submit" className="justify-self-start">Inscrever selecionados</Button>
      </form>
    </section>
  );
}
```

- [ ] **Passo 3: Ver rodando** pelo Playwright MCP, em 1440 e 390:
  - criar um evento com data de hoje;
  - inscrever dois participantes;
  - inscrever de novo um deles, que aparece "já inscrito" e desabilitado;
  - conferir o contador "0/2";
  - baixar o PDF de um e o ZIP do evento;
  - remover uma inscrição;
  - apagar o evento.

  Screenshot de cada estado.

- [ ] **Passo 4: Verificar e commitar.** `git commit -m "Adiciona eventos e inscrições (#<issue>)"`

---

### Tarefa 7: Importação de planilha

**Arquivos:**
- Criar: `src/lib/planilha.ts`, `src/app/participantes/importar/actions.ts`, `src/app/participantes/importar/importador.tsx`, `src/app/participantes/importar/page.tsx`, `src/app/participantes/modelo/route.ts`
- Teste: `src/lib/planilha.test.ts`

**Interfaces:**
- Consome: `participanteSchema`, `lerTipoParticipante`, `normalizarBusca`, `gerarCodigo` e a tabela `eventos`.
- Produz:
  - `COLUNAS`, `lerPlanilha(bytes: Uint8Array): LinhaBruta[]`, `validarLinhas(linhas): LinhaValidada[]`, `modeloPlanilha(): Uint8Array`;
  - `previsualizar(form)`, `importar(form)`.

- [ ] **Passo 1: Escrever o teste que falha.** É aqui que mora o item 1 do Foco da revisão.

```ts
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { lerPlanilha, modeloPlanilha, validarLinhas } from "./planilha";

function xlsx(linhas: unknown[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), "p");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

describe("lerPlanilha", () => {
  it("lê o modelo que o sistema oferece para baixar", () => {
    const linhas = lerPlanilha(modeloPlanilha());
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ linha: 2, nome: "Maria da Silva", tipo: "Convidado" });
  });

  it("aceita cabeçalho com acento, caixa e apelido", () => {
    const [l] = lerPlanilha(
      xlsx([
        ["Nome", "CPF", "Data de Nascimento", "E-mail", "Celular", "Empresa", "Cargo"],
        ["Ana", "52998224725", "17/05/1990", "a@b.com", "11", "Acme", "VIP"],
      ]),
    );
    expect(l).toMatchObject({ nome: "Ana", documento: "52998224725", data_nascimento: "1990-05-17", email: "a@b.com", telefone: "11", empresa: "Acme", tipo: "VIP" });
  });

  it("devolve o zero à esquerda que o Excel come do CPF numérico", () => {
    const [l] = lerPlanilha(xlsx([["nome", "documento", "tipo"], ["Ana", 1234567890, "vip"]]));
    expect(l.documento).toBe("01234567890");
  });

  it("converte data serial do Excel sem desvio de fuso", () => {
    // 25569 = 1970-01-01; 32994 - 25569 = 7425 dias = 1990-05-01
    const [l] = lerPlanilha(xlsx([["nome", "data_nascimento"], ["Ana", 32994]]));
    expect(l.data_nascimento).toBe("1990-05-01");
  });

  it("lê CSV UTF-8 separado por ponto e vírgula", () => {
    const [l] = lerPlanilha(new TextEncoder().encode("nome;documento;tipo\nJosé Conceição;529.982.247-25;Palestrante\n"));
    expect(l).toMatchObject({ nome: "José Conceição", documento: "529.982.247-25", tipo: "Palestrante" });
  });

  it("lê CSV UTF-8 com BOM sem sujar o primeiro cabeçalho", () => {
    const [l] = lerPlanilha(new TextEncoder().encode("﻿nome,documento\nAna,1\n"));
    expect(l).toMatchObject({ nome: "Ana", documento: "1" });
  });

  it("CSV: data dd/mm brasileira e CPF com zero à esquerda chegam intactos", () => {
    const [l] = lerPlanilha(new TextEncoder().encode("nome,documento,data_nascimento\nAna,01234567890,05/06/1990\n"));
    expect(l).toMatchObject({ documento: "01234567890", data_nascimento: "1990-06-05" });
  });

  it("lê CSV salvo pelo Excel brasileiro (Windows-1252)", () => {
    const [l] = lerPlanilha(new Uint8Array(Buffer.from("nome;documento;tipo\r\nJosé Conceição;529.982.247-25;VIP\r\n", "latin1")));
    expect(l.nome).toBe("José Conceição");
  });

  it("ignora linha totalmente vazia e numera pela linha da planilha", () => {
    const linhas = lerPlanilha(xlsx([["nome", "documento"], ["Ana", "1"], ["", ""], ["Bia", "2"]]));
    expect(linhas.map((l) => l.linha)).toEqual([2, 4]);
  });
});

describe("validarLinhas", () => {
  const base = { nome: "Ana", documento: "529.982.247-25", data_nascimento: "", email: "", telefone: "", empresa: " Acme  Ltda ", tipo: "VIPs" };

  it("valida, normaliza tipo e empresa", () => {
    const [r] = validarLinhas([{ linha: 2, ...base }]);
    expect(r).toEqual({
      linha: 2,
      ok: true,
      dados: { nome: "Ana", documento: "52998224725", data_nascimento: null, email: null, telefone: null, tipo: "vip", empresa: "Acme Ltda" },
    });
  });

  it("documento repetido na mesma planilha aponta a linha anterior", () => {
    const r = validarLinhas([{ linha: 2, ...base }, { linha: 3, ...base, documento: "52998224725" }]);
    expect(r[1]).toEqual({ linha: 3, ok: false, erros: ["Documento repetido na linha 2"] });
  });

  it("linha ruim não derruba as outras", () => {
    const r = validarLinhas([{ linha: 2, ...base, tipo: "Imprensa" }, { linha: 3, ...base }]);
    expect(r.map((x) => x.ok)).toEqual([false, true]);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar.** Esperado: FAIL, porque `./planilha` não existe.

- [ ] **Passo 3: Implementar.** Três armadilhas do SheetJS, todas comprovadas rodando:
  - CSV sem BOM é lido como Latin-1, e por isso o texto é decodificado antes, tentando UTF-8 estrito e caindo para Windows-1252;
  - sem `raw: true`, "05/06/1990" vira 6 de maio e o CPF perde o zero;
  - célula numérica de CPF no .xlsx também perde o zero, e `padStart(11, "0")` devolve.

```ts
import * as XLSX from "xlsx";
import { participanteSchema, lerTipoParticipante, type ParticipanteInput } from "./dominio";
import { semAcento } from "./texto";

export const COLUNAS = ["nome", "documento", "data_nascimento", "email", "telefone", "empresa", "tipo"] as const;
type Coluna = (typeof COLUNAS)[number];

const APELIDOS: Record<string, Coluna> = {
  nome: "nome",
  documento: "documento",
  cpf: "documento",
  data_nascimento: "data_nascimento",
  data_de_nascimento: "data_nascimento",
  nascimento: "data_nascimento",
  email: "email",
  e_mail: "email",
  telefone: "telefone",
  celular: "telefone",
  empresa: "empresa",
  tipo: "tipo",
  cargo: "tipo",
  tipo_cargo: "tipo",
};

export type LinhaBruta = { linha: number } & Record<Coluna, string>;
export type DadosImportacao = ParticipanteInput & { empresa: string | null };
export type LinhaValidada =
  | { linha: number; ok: true; dados: DadosImportacao }
  | { linha: number; ok: false; erros: string[] };

function chaveCabecalho(valor: unknown): Coluna | undefined {
  const chave = semAcento(String(valor)).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return APELIDOS[chave];
}

function celulaTexto(coluna: Coluna, valor: unknown): string {
  if (typeof valor === "number") {
    // Excel guarda CPF digitado como número e come o zero à esquerda.
    if (coluna === "documento") return String(Math.round(valor)).padStart(11, "0");
    // Data do Excel chega como número serial de dias.
    if (coluna === "data_nascimento") {
      const d = XLSX.SSF.parse_date_code(valor);
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  const texto = String(valor ?? "").trim();
  const br = coluna === "data_nascimento" && texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return texto;
}

// .xlsx é zip ("PK"), .xls é CFB (D0 CF 11 E0). O resto é CSV/texto.
function ehBinario(b: Uint8Array): boolean {
  return (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
}

// SheetJS lê CSV sem BOM como Latin-1 e estraga UTF-8. Tenta UTF-8 estrito; se não for, é o
// Windows-1252 que o Excel brasileiro grava.
function decodificarTexto(b: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return new TextDecoder("windows-1252").decode(b);
  }
}

// Primeira aba; linha 1 da planilha é o cabeçalho, então os dados começam na linha 2.
export function lerPlanilha(arquivo: Uint8Array): LinhaBruta[] {
  // raw no CSV: sem isso o SheetJS lê "05/06/1990" como data americana (6 de maio) e come zero de CPF.
  const wb = ehBinario(arquivo)
    ? XLSX.read(arquivo, { type: "array" })
    : XLSX.read(decodificarTexto(arquivo), { type: "string", raw: true });
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) return [];
  const [cabecalho = [], ...linhas] = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: "" });
  const mapa = cabecalho.map(chaveCabecalho);
  return linhas
    .map((celulas, i) => {
      const linha = { linha: i + 2 } as LinhaBruta;
      for (const c of COLUNAS) linha[c] = "";
      mapa.forEach((coluna, j) => {
        if (coluna) linha[coluna] = celulaTexto(coluna, celulas[j]);
      });
      return linha;
    })
    .filter((l) => COLUNAS.some((c) => l[c] !== ""));
}

export function validarLinhas(linhas: LinhaBruta[]): LinhaValidada[] {
  const vistos = new Map<string, number>();
  return linhas.map((l) => {
    const r = participanteSchema.safeParse({ ...l, tipo: lerTipoParticipante(l.tipo) ?? l.tipo });
    if (!r.success) return { linha: l.linha, ok: false, erros: r.error.issues.map((i) => i.message) };
    const anterior = vistos.get(r.data.documento);
    if (anterior) return { linha: l.linha, ok: false, erros: [`Documento repetido na linha ${anterior}`] };
    vistos.set(r.data.documento, l.linha);
    return { linha: l.linha, ok: true, dados: { ...r.data, empresa: l.empresa.replace(/\s+/g, " ").trim() || null } };
  });
}

export function modeloPlanilha(): Uint8Array {
  const aba = XLSX.utils.aoa_to_sheet([
    [...COLUNAS],
    ["Maria da Silva", "529.982.247-25", "1990-05-17", "maria@exemplo.com", "(11) 91234-5678", "Acme", "Convidado"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aba, "participantes");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}
```

- [ ] **Passo 4: Rodar e ver passar.** Esperado: 27 + 12 = **39 testes**.

- [ ] **Passo 5: Actions e tela.** O upload passa por Server Action, que tem o limite de 4 MB do `next.config.ts` (Tarefa 1). O arquivo é limitado a 3 MB, abaixo dos 4,5 MB que a Vercel aceita. A confirmação reenvia o **mesmo arquivo** e o servidor revalida tudo: nada da prévia no navegador é confiado.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { lerPlanilha, validarLinhas, type DadosImportacao, type LinhaValidada } from "@/lib/planilha";
import { normalizarBusca } from "@/lib/texto";
import { gerarCodigo } from "@/lib/codigo";

// Vercel recusa corpo acima de 4,5 MB e o next.config libera 4 MB para Server Actions.
const LIMITE_BYTES = 3 * 1024 * 1024;

export type Previa = { linhas: (LinhaValidada & { existente?: boolean })[]; novos: number; existentes: number; comErro: number };
type Lida = { ok: false; mensagem: string } | { ok: true; linhas: LinhaValidada[] };

async function ler(form: FormData): Promise<Lida> {
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

export async function previsualizar(form: FormData): Promise<{ ok: false; mensagem: string } | { ok: true; previa: Previa }> {
  const lida = await ler(form);
  if (!lida.ok) return lida;
  const documentos = lida.linhas.flatMap((l) => (l.ok ? [l.dados.documento] : []));
  // .in() vai na URL; em fatias de 200 a URL fica abaixo do limite do PostgREST mesmo com milhares de linhas.
  const ja = new Set<string>();
  for (let i = 0; i < documentos.length; i += 200) {
    const { data, error } = await db().from("participantes").select("documento").in("documento", documentos.slice(i, i + 200));
    if (error) return { ok: false, mensagem: error.message };
    for (const d of data) ja.add(d.documento as string);
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
// ponytail: três escritas sem transação; reimportar é idempotente (upsert), então uma falha no meio se resolve repetindo.
export async function importar(form: FormData): Promise<{ ok: boolean; mensagem: string }> {
  const lida = await ler(form);
  if (!lida.ok) return lida;
  const validos = lida.linhas.flatMap((l) => (l.ok ? [l.dados] : []));
  if (validos.length === 0) return { ok: false, mensagem: "Nenhuma linha válida para gravar" };

  const empresaIds = await garantirEmpresas(validos);
  const { data: gravados, error } = await db()
    .from("participantes")
    .upsert(
      validos.map(({ empresa, ...p }) => ({ ...p, nome_busca: normalizarBusca(p.nome), empresa_id: empresa ? empresaIds.get(empresa.toLowerCase()) : null })),
      { onConflict: "documento" },
    )
    .select("id");
  if (error) return { ok: false, mensagem: `Erro ao gravar participantes: ${error.message}` };

  const eventoId = form.get("evento_id")?.toString();
  if (eventoId) {
    const { error: e2 } = await db()
      .from("inscricoes")
      .upsert(gravados.map((g) => ({ participante_id: g.id, evento_id: eventoId, codigo: gerarCodigo() })), {
        onConflict: "participante_id,evento_id",
        ignoreDuplicates: true,
      });
    if (e2) return { ok: false, mensagem: `Participantes gravados, mas a inscrição no evento falhou: ${e2.message}` };
    revalidatePath(`/eventos/${eventoId}`);
  }
  revalidatePath("/participantes");
  const ignoradas = lida.linhas.length - validos.length;
  return { ok: true, mensagem: `${gravados.length} participantes gravados${ignoradas ? `, ${ignoradas} linhas com erro ignoradas` : ""}` };
}

// Empresa vem pelo nome; cria as que faltam. Chave do mapa em minúsculas, como o índice único do banco.
async function garantirEmpresas(linhas: DadosImportacao[]): Promise<Map<string, string>> {
  const { data, error } = await db().from("empresas").select("id, nome");
  if (error) throw new Error(error.message);
  const mapa = new Map(data.map((e) => [(e.nome as string).toLowerCase(), e.id as string]));
  const faltando = new Map<string, string>();
  for (const l of linhas) if (l.empresa && !mapa.has(l.empresa.toLowerCase())) faltando.set(l.empresa.toLowerCase(), l.empresa);
  if (faltando.size) {
    const { data: novas, error: e2 } = await db().from("empresas").insert([...faltando.values()].map((nome) => ({ nome }))).select("id, nome");
    if (e2) throw new Error(e2.message);
    for (const e of novas) mapa.set((e.nome as string).toLowerCase(), e.id as string);
  }
  return mapa;
}
```

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importar, previsualizar, type Previa } from "./actions";

export function Importador({ eventos }: { eventos: { id: string; nome: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  const dados = () => new FormData(formRef.current!);

  return (
    <div className="grid gap-6">
      <form ref={formRef} className="grid max-w-xl gap-4" onChange={() => setPrevia(null)}>
        <div className="grid gap-1.5">
          <Label htmlFor="arquivo">Planilha (CSV ou Excel)</Label>
          <input id="arquivo" name="arquivo" type="file" accept=".csv,.xlsx,.xls" required className="text-sm" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="evento_id">Inscrever todos no evento (opcional)</Label>
          <select id="evento_id" name="evento_id" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            <option value="">Não inscrever</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pendente}
          className="justify-self-start"
          onClick={() =>
            iniciar(async () => {
              const r = await previsualizar(dados());
              if (r.ok) setPrevia(r.previa);
              else toast.error(r.mensagem);
            })
          }
        >
          {pendente && !previa ? "Lendo…" : "Ver prévia"}
        </Button>
      </form>

      {previa && (
        <div className="grid gap-4">
          <p className="text-sm">
            <strong>{previa.novos}</strong> novos · <strong>{previa.existentes}</strong> já cadastrados (serão atualizados com os dados da planilha) ·{" "}
            <strong className={previa.comErro ? "text-destructive" : undefined}>{previa.comErro}</strong> com erro (não serão gravados)
          </p>
          {previa.comErro > 0 && (
            <ul className="grid gap-1 text-sm text-destructive">
              {previa.linhas.flatMap((l) => (l.ok ? [] : [<li key={l.linha}>Linha {l.linha}: {l.erros.join("; ")}</li>]))}
            </ul>
          )}
          <Button
            type="button"
            disabled={pendente || previa.novos + previa.existentes === 0}
            className="justify-self-start"
            onClick={() =>
              iniciar(async () => {
                const r = await importar(dados());
                if (!r.ok) return void toast.error(r.mensagem);
                toast.success(r.mensagem);
                router.push("/participantes");
              })
            }
          >
            {pendente ? "Gravando…" : `Gravar ${previa.novos + previa.existentes} participantes`}
          </Button>
        </div>
      )}
    </div>
  );
}
```

```tsx
import Link from "next/link";
import { db } from "@/lib/supabase";
import { COLUNAS } from "@/lib/planilha";
import { Importador } from "./importador";

export default async function Importar() {
  const { data: eventos, error } = await db().from("eventos").select("id, nome").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Importar planilha</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Colunas esperadas: <code>{COLUNAS.join(", ")}</code>. Obrigatórias: nome, documento e tipo.{" "}
        <Link href="/participantes/modelo" className="underline">Baixar o modelo</Link>.
      </p>
      <Importador eventos={eventos} />
    </section>
  );
}
```

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

- [ ] **Passo 6: Ver rodando** pelo Playwright MCP, em 1440 e 390:
  - baixar o modelo;
  - importar o modelo como veio;
  - importar um CSV com `;`, acento, uma linha com CPF inválido, uma com tipo "Imprensa" e uma repetida, escolhendo um evento;
  - conferir que a prévia mostra os três grupos e as linhas com erro;
  - confirmar;
  - conferir que os válidos aparecem na lista e no evento, e que a empresa nova foi criada;
  - reimportar o mesmo arquivo, que deve atualizar sem duplicar.

  Screenshot da prévia e do resultado.

- [ ] **Passo 7: Commitar.** `git commit -m "Adiciona importação de participantes por planilha (#<issue>)"`

---

### Tarefa 8: Check-in pelo celular

**Arquivos:**
- Criar: `src/app/checkin/actions.ts`, `src/app/checkin/page.tsx`, `src/app/checkin/leitor.tsx`

**Interfaces:**
- Consome: `buscarParticipantes`, `ehUuid`, `TIPOS_PARTICIPANTE`, `formatarData`.
- Produz:
  - `checkinPorCodigo(codigo, eventoId | null)` e `checkinPorInscricao(inscricaoId, eventoId | null)`, que devolvem `ResultadoCheckin` com status `ok`, `repetido`, `outro_evento` ou `desconhecido`;
  - `buscarInscritos(termo, eventoId | null)`.
- Textos que o E2E procura, e que portanto não podem mudar: "Check-in feito · entregar crachá", "Já fez check-in às", "QR de outro evento", "Código não encontrado"; rótulos "Evento", "Código do QR", "Buscar inscrito"; botão "Validar".

- [ ] **Passo 1: Actions.** O check-in é **um único UPDATE** condicionado a `checkin_em is null`. É o que garante um verde e um amarelo quando dois celulares leem o mesmo QR. Esse comportamento foi verificado no Postgres (PGlite): a segunda execução não devolve linha.

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
  participante: { nome: string; tipo: TipoParticipante; empresa: { nome: string } | null };
  evento: { nome: string };
};

const CAMPOS = "id, evento_id, checkin_em, participante:participantes(nome, tipo, empresa:empresas(nome)), evento:eventos(nome)";

export async function checkinPorCodigo(codigo: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const limpo = codigo.trim();
  return limpo ? registrar("codigo", limpo, eventoId) : { status: "desconhecido" };
}

export async function checkinPorInscricao(inscricaoId: string, eventoId: string | null): Promise<ResultadoCheckin> {
  return ehUuid(inscricaoId) ? registrar("id", inscricaoId, eventoId) : { status: "desconhecido" };
}

async function registrar(coluna: "codigo" | "id", valor: string, eventoId: string | null): Promise<ResultadoCheckin> {
  const { data, error } = await db().from("inscricoes").select(CAMPOS).eq(coluna, valor).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { status: "desconhecido" };
  const l = data as unknown as Linha;
  if (eventoId && l.evento_id !== eventoId) return { status: "outro_evento", nome: l.participante.nome, evento: l.evento.nome };

  const base = { nome: l.participante.nome, tipo: TIPOS_PARTICIPANTE[l.participante.tipo], empresa: l.participante.empresa?.nome ?? null, evento: l.evento.nome };
  // Um único UPDATE condicionado a checkin_em vazio: dois celulares no mesmo QR dão um "ok" e um "repetido".
  const { data: marcadas, error: e2 } = await db()
    .from("inscricoes")
    .update({ checkin_em: new Date().toISOString() })
    .eq("id", l.id)
    .is("checkin_em", null)
    .select("checkin_em");
  if (e2) throw new Error(e2.message);
  revalidatePath(`/eventos/${l.evento_id}`);
  if (marcadas.length) return { status: "ok", ...base, checkinEm: marcadas[0].checkin_em as string };

  const { data: atual } = await db().from("inscricoes").select("checkin_em").eq("id", l.id).single();
  return { status: "repetido", ...base, checkinEm: (atual?.checkin_em as string | undefined) ?? l.checkin_em ?? "" };
}

export type Inscrito = { inscricaoId: string; nome: string; documento: string; empresa: string | null; evento: string; checkinEm: string | null };

// Busca manual: para quem chega sem QR legível.
export async function buscarInscritos(termo: string, eventoId: string | null): Promise<Inscrito[]> {
  if (termo.trim().length < 2) return [];
  const participantes = await buscarParticipantes({ termo, limite: 30 });
  if (participantes.length === 0) return [];
  let q = db()
    .from("inscricoes")
    .select("id, participante_id, checkin_em, evento:eventos(nome)")
    .in("participante_id", participantes.map((p) => p.id));
  if (eventoId) q = q.eq("evento_id", eventoId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const porId = new Map(participantes.map((p) => [p.id, p]));
  return (data as unknown as { id: string; participante_id: string; checkin_em: string | null; evento: { nome: string } }[]).map((i) => {
    const p = porId.get(i.participante_id)!;
    return { inscricaoId: i.id, nome: p.nome, documento: p.documento, empresa: p.empresa?.nome ?? null, evento: i.evento.nome, checkinEm: i.checkin_em };
  });
}
```

- [ ] **Passo 2: Tela.** O `qr-scanner` só existe no navegador, por isso o `import()` dinâmico dentro do `useEffect` e o `destroy()` no cleanup. A câmera lê o mesmo QR várias vezes por segundo, então a mesma leitura em menos de 3 segundos é ignorada. O campo de código também atende leitor USB de código de barras.

```tsx
import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/dominio";
import { Leitor } from "./leitor";

export default async function Checkin() {
  const { data, error } = await db().from("eventos").select("id, nome, data").order("data", { ascending: false });
  if (error) throw new Error(error.message);
  // Evento de hoje (fuso de Brasília) já vem selecionado; sem evento hoje, lê de qualquer um.
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const eventos = data.map((e) => ({ id: e.id as string, rotulo: `${e.nome} · ${formatarData(e.data as string)}` }));
  return <Leitor eventos={eventos} padrao={data.find((e) => e.data === hoje)?.id ?? ""} />;
}
```

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarInscritos, checkinPorCodigo, checkinPorInscricao, type Inscrito, type ResultadoCheckin } from "./actions";

const COR = {
  ok: "border-green-600 bg-green-50 text-green-950 dark:bg-green-950 dark:text-green-50",
  repetido: "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50",
  outro_evento: "border-red-600 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
  desconhecido: "border-red-600 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50",
} as const;

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function Cartao({ r }: { r: ResultadoCheckin }) {
  return (
    <div role="status" aria-live="assertive" className={`rounded-xl border-2 p-5 ${COR[r.status]}`}>
      {r.status === "ok" && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide">Check-in feito · entregar crachá</p>
          <p className="mt-1 text-3xl font-bold">{r.nome}</p>
          <p className="text-lg">{r.tipo}{r.empresa ? ` · ${r.empresa}` : ""}</p>
        </>
      )}
      {r.status === "repetido" && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide">Já fez check-in às {hora(r.checkinEm)}</p>
          <p className="mt-1 text-3xl font-bold">{r.nome}</p>
          <p className="text-lg">{r.tipo}{r.empresa ? ` · ${r.empresa}` : ""} · não entregar outro crachá</p>
        </>
      )}
      {r.status === "outro_evento" && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide">QR de outro evento</p>
          <p className="mt-1 text-3xl font-bold">{r.nome}</p>
          <p className="text-lg">Inscrito em: {r.evento}</p>
        </>
      )}
      {r.status === "desconhecido" && <p className="text-2xl font-bold">Código não encontrado</p>}
    </div>
  );
}

export function Leitor({ eventos, padrao }: { eventos: { id: string; rotulo: string }[]; padrao: string }) {
  const [eventoId, setEventoId] = useState(padrao);
  const [resultado, setResultado] = useState<ResultadoCheckin | null>(null);
  const [erroCamera, setErroCamera] = useState("");
  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [pendente, iniciar] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  // O callback do scanner é criado uma vez; lê evento e último código por ref para não reabrir a câmera.
  const eventoRef = useRef(padrao);
  const ultimo = useRef({ codigo: "", em: 0 });

  useEffect(() => {
    eventoRef.current = eventoId;
  }, [eventoId]);

  const lerCodigo = (codigo: string) => {
    // A câmera lê o mesmo QR várias vezes por segundo; repetição em menos de 3 s é ignorada.
    const agora = Date.now();
    if (codigo === ultimo.current.codigo && agora - ultimo.current.em < 3000) return;
    ultimo.current = { codigo, em: agora };
    iniciar(async () => setResultado(await checkinPorCodigo(codigo, eventoRef.current || null)));
  };
  const lerCodigoRef = useRef(lerCodigo);
  useEffect(() => {
    lerCodigoRef.current = lerCodigo;
  });

  useEffect(() => {
    let scanner: { destroy(): void } | undefined;
    let cancelado = false;
    (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelado || !video.current) return;
      const s = new QrScanner(video.current, (r) => lerCodigoRef.current(r.data), {
        returnDetailedScanResult: true,
        preferredCamera: "environment",
        maxScansPerSecond: 5,
      });
      scanner = s;
      try {
        await s.start();
      } catch {
        if (!cancelado) setErroCamera("Não foi possível abrir a câmera. Use o campo de código ou a busca por nome.");
      }
    })();
    return () => {
      cancelado = true;
      scanner?.destroy();
    };
  }, []);

  return (
    <section className="mx-auto grid max-w-lg gap-4">
      <h1 className="text-2xl font-semibold">Check-in</h1>
      <select
        aria-label="Evento"
        value={eventoId}
        onChange={(e) => setEventoId(e.target.value)}
        className="h-10 rounded-lg border border-input bg-transparent px-2.5"
      >
        <option value="">Qualquer evento</option>
        {eventos.map((e) => (
          <option key={e.id} value={e.id}>{e.rotulo}</option>
        ))}
      </select>

      <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
      {erroCamera && <p className="text-sm text-destructive">{erroCamera}</p>}

      {resultado && <Cartao r={resultado} />}

      {/* Leitor de código de barras USB digita o código e manda Enter: cai aqui também. */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const campo = e.currentTarget.elements.namedItem("codigo") as HTMLInputElement;
          lerCodigo(campo.value);
          campo.value = "";
        }}
      >
        <Input name="codigo" placeholder="Digite ou cole o código" aria-label="Código do QR" autoComplete="off" />
        <Button type="submit" disabled={pendente}>Validar</Button>
      </form>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const termo = (e.currentTarget.elements.namedItem("termo") as HTMLInputElement).value;
          iniciar(async () => setInscritos(await buscarInscritos(termo, eventoId || null)));
        }}
      >
        <Input name="termo" placeholder="Sem QR? Busque por nome ou CPF" aria-label="Buscar inscrito" />
        <Button type="submit" variant="outline" disabled={pendente}>Buscar</Button>
      </form>
      <ul className="grid gap-2">
        {inscritos.map((i) => (
          <li key={i.inscricaoId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block font-medium">{i.nome}</span>
              <span className="block text-xs text-muted-foreground">
                {i.documento}{i.empresa ? ` · ${i.empresa}` : ""} · {i.evento}{i.checkinEm ? ` · check-in às ${hora(i.checkinEm)}` : ""}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              disabled={pendente}
              onClick={() =>
                iniciar(async () => {
                  setResultado(await checkinPorInscricao(i.inscricaoId, eventoId || null));
                  setInscritos([]);
                })
              }
            >
              Check-in
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Passo 3: Ver rodando.**
  - Pelo Playwright MCP em 390 de largura, pelo campo de código: verde, depois amarelo, depois um código qualquer em vermelho, depois um código de outro evento em vermelho com o nome desse evento.
  - Pela busca manual: buscar e fazer check-in.
  - **No celular de verdade**, com o deploy de preview na Vercel (a câmera exige HTTPS): ler o QR de um PDF gerado na Tarefa 5, no Android e no iPhone. O `qr-scanner` não garante a câmera traseira no Safari; registre o que aconteceu.

  Screenshots dos quatro cartões.

- [ ] **Passo 4: Verificar e commitar.** `git commit -m "Adiciona check-in por QR, código e busca manual (#<issue>)"`

---

### Tarefa 9: Envio da credencial por e-mail

**Arquivos:**
- Criar: `src/lib/email.ts`, `src/app/eventos/[id]/email-actions.ts`, `src/app/eventos/[id]/envio-email.tsx`
- Modificar: `src/app/eventos/[id]/page.tsx`, que é substituído pela versão final abaixo

**Interfaces:**
- Consome: `carregarCredenciais`, `gerarCredencialPdf`, `nomeArquivo`, `escaparHtml`.
- Produz: `emailConfigurado()`, `enviarCredencial(c, pdf)`, `enviarEmailInscricao(id)`, `enviarLoteEmail(eventoId): ResultadoLote`, `<EnvioEmail>` e `<BotaoEmailUm>`.

- [ ] **Passo 1: Envio.** Regras:
  - `error.name` igual a `daily_quota_exceeded` ou `monthly_quota_exceeded` **não** marca erro na inscrição, para ela continuar pendente para o dia seguinte;
  - qualquer outro erro grava `email_erro` e sai do lote, para não virar laço infinito;
  - o lote tem 10 envios por chamada, e o navegador chama de novo mostrando o progresso.

```ts
import "server-only";
import { Resend } from "resend";
import type { Credencial } from "./credencial";
import { escaparHtml } from "./texto";
import { nomeArquivo } from "./zip";

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type ResultadoEnvio = { ok: true } | { ok: false; erro: string; cotaEsgotada: boolean };

export async function enviarCredencial(c: Credencial, pdf: Uint8Array): Promise<ResultadoEnvio> {
  if (!c.email) return { ok: false, erro: "Participante sem e-mail", cotaEsgotada: false };
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: c.email,
    subject: `Sua credencial: ${c.evento}`,
    html:
      `<p>Olá, ${escaparHtml(c.nome)}.</p>` +
      `<p>Segue em anexo sua credencial para <strong>${escaparHtml(c.evento)}</strong> (${c.data}).</p>` +
      `<p>Apresente o QR code na entrada, no celular ou impresso.</p>`,
    // Resend serializa Uint8Array/Buffer errado no JSON; base64 é o formato seguro.
    attachments: [{ filename: `${nomeArquivo(c.nome)}.pdf`, content: Buffer.from(pdf).toString("base64") }],
  });
  if (!error) return { ok: true };
  return {
    ok: false,
    erro: error.message,
    cotaEsgotada: error.name === "daily_quota_exceeded" || error.name === "monthly_quota_exceeded",
  };
}
```

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { carregarCredenciais, type Credencial } from "@/lib/credencial";
import { emailConfigurado, enviarCredencial, type ResultadoEnvio } from "@/lib/email";
import { gerarCredencialPdf } from "@/lib/pdf";
import type { EstadoAcao } from "@/lib/acao";

const LOTE = 10;

// Cota esgotada não marca erro: a inscrição continua pendente e entra no lote de amanhã.
async function enviarERegistrar(c: Credencial): Promise<ResultadoEnvio> {
  const r = await enviarCredencial(c, await gerarCredencialPdf(c));
  if (r.ok) await db().from("inscricoes").update({ email_enviado_em: new Date().toISOString(), email_erro: null }).eq("id", c.inscricaoId);
  else if (!r.cotaEsgotada) await db().from("inscricoes").update({ email_erro: r.erro }).eq("id", c.inscricaoId);
  return r;
}

export async function enviarEmailInscricao(inscricaoId: string): Promise<EstadoAcao> {
  if (!emailConfigurado()) return { ok: false, mensagem: "Envio por e-mail não configurado" };
  const [c] = await carregarCredenciais({ ids: [inscricaoId] });
  if (!c) return { ok: false, mensagem: "Inscrição não encontrada" };
  const r = await enviarERegistrar(c);
  revalidatePath("/eventos/[id]", "page");
  return r.ok ? { ok: true, mensagem: `E-mail enviado para ${c.email}` } : { ok: false, mensagem: r.erro };
}

export type ResultadoLote = { enviados: number; falhas: number; restantes: number; cotaEsgotada: boolean };

// Um lote por chamada; o navegador chama de novo até restantes = 0. Cada chamada fica bem abaixo do
// limite de duração da função na Vercel, e o progresso aparece na tela entre um lote e outro.
export async function enviarLoteEmail(eventoId: string): Promise<ResultadoLote> {
  if (!emailConfigurado()) return { enviados: 0, falhas: 0, restantes: 0, cotaEsgotada: false };
  const pendentes = () =>
    db().from("inscricoes").select("id", { count: "exact" }).eq("evento_id", eventoId).is("email_enviado_em", null).is("email_erro", null);
  const { data, error } = await pendentes().limit(LOTE);
  if (error) throw new Error(error.message);
  const credenciais = data.length ? await carregarCredenciais({ ids: data.map((d) => d.id as string) }) : [];
  let enviados = 0;
  let falhas = 0;
  let cotaEsgotada = false;
  for (const c of credenciais) {
    const r = await enviarERegistrar(c);
    if (r.ok) enviados++;
    else if (r.cotaEsgotada) {
      cotaEsgotada = true;
      break;
    } else falhas++;
  }
  const { count } = await pendentes().limit(1);
  revalidatePath(`/eventos/${eventoId}`);
  return { enviados, falhas, restantes: count ?? 0, cotaEsgotada };
}
```

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enviarEmailInscricao, enviarLoteEmail } from "./email-actions";

export function EnvioEmail({ eventoId, configurado }: { eventoId: string; configurado: boolean }) {
  const [progresso, setProgresso] = useState("");
  const [rodando, iniciar] = useTransition();

  if (!configurado) {
    return (
      <p className="text-sm text-muted-foreground">
        Envio por e-mail desligado. Para ligar, configure <code>RESEND_API_KEY</code> e <code>EMAIL_FROM</code> na Vercel.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={rodando}
        onClick={() =>
          iniciar(async () => {
            let enviados = 0;
            let falhas = 0;
            for (;;) {
              const r = await enviarLoteEmail(eventoId);
              enviados += r.enviados;
              falhas += r.falhas;
              setProgresso(`${enviados} enviados · ${falhas} falhas · ${r.restantes} faltando`);
              if (r.cotaEsgotada) return void toast.error("Cota de e-mails do Resend esgotada. Os que faltam continuam pendentes para depois.");
              // Lote vazio = acabou. Sem isso, um lote vazio com restantes > 0 viraria laço infinito.
              if (r.restantes === 0 || r.enviados + r.falhas === 0) break;
            }
            toast.success(`Envio concluído: ${enviados} enviados, ${falhas} falhas`);
          })
        }
      >
        {rodando ? "Enviando…" : "Enviar e-mail para quem ainda não recebeu"}
      </Button>
      {progresso && <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{progresso}</span>}
    </div>
  );
}

export function BotaoEmailUm({ inscricaoId }: { inscricaoId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await enviarEmailInscricao(inscricaoId);
          if (r.ok) toast.success(r.mensagem);
          else toast.error(r.mensagem);
        })
      }
    >
      E-mail
    </Button>
  );
}
```

- [ ] **Passo 2: Página do evento, versão final.** Substitua `src/app/eventos/[id]/page.tsx` por:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotaoApagar } from "@/components/botao-apagar";
import { db } from "@/lib/supabase";
import { emailConfigurado } from "@/lib/email";
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
          <p className="text-sm text-muted-foreground">
            {TIPOS_EVENTO[evento.tipo as TipoEvento]} · {formatarData(evento.data)}
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums" aria-label="Presentes sobre inscritos">
          {presentes}/{inscricoes.length}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/eventos/${id}/inscrever`} className={buttonVariants()}>Inscrever participantes</Link>
        <a href={`/eventos/${id}/zip`} className={buttonVariants({ variant: "outline" })}>Baixar PDFs (ZIP)</a>
        <Link href={`/eventos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar</Link>
        <BotaoApagar acao={apagarEvento.bind(null, id)} confirmacao={`Apagar o evento ${evento.nome} e todas as inscrições?`} rotulo="Apagar evento" />
      </div>

      <EnvioEmail eventoId={id} configurado={configurado} />

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
                {i.participante.nome}
                {i.participante.empresa && <span className="block text-xs text-muted-foreground">{i.participante.empresa.nome}</span>}
              </TableCell>
              <TableCell><Badge variant="secondary">{TIPOS_PARTICIPANTE[i.participante.tipo]}</Badge></TableCell>
              <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
              <TableCell className="tabular-nums">{i.checkin_em ? hora(i.checkin_em) : "—"}</TableCell>
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
    </section>
  );
}
```

- [ ] **Passo 3: Ver rodando.**
  - **Sem** `RESEND_API_KEY`: a página do evento mostra "Envio por e-mail desligado…" e nenhum botão de e-mail.
  - **Com** uma chave de teste do Resend e `EMAIL_FROM=onboarding@resend.dev` (o Resend só entrega, nesse modo, para o e-mail do dono da conta): enviar para um participante com o e-mail do autor e conferir que o PDF anexo abre e que o QR lê o código.
  - Se não houver chave de teste disponível, registre no `IMPLEMENTACAO.md` que o envio real não foi exercitado. **Não finja.**

- [ ] **Passo 4: Verificar e commitar.** `git commit -m "Adiciona envio da credencial por e-mail (#<issue>)"`

---

### Tarefa 10: Teste de ponta a ponta, README e verificação final

**Arquivos:**
- Criar: `playwright.config.ts`, `e2e/fluxo.spec.ts`
- Modificar: `README.md`

- [ ] **Passo 1: Playwright.** O teste roda duas vezes, uma em desktop (1440) e outra em celular (Pixel 7). Ele grava no Supabase do `.env.local` e apaga no `afterAll` tudo o que criou, pelo prefixo `E2E <timestamp>`.

```ts
import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// O E2E grava no Supabase de verdade: lê as mesmas variáveis do `next dev`.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "npm run dev", url: "http://localhost:3000/eventos", reuseExistingServer: true, timeout: 120_000 },
});
```

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
  await db.from("eventos").delete().like("nome", `${PREFIXO}%`);
  await db.from("participantes").delete().like("nome", `${PREFIXO}%`);
  await db.from("empresas").delete().like("nome", `${PREFIXO}%`);
});

test("cadastro, inscrição, PDF e check-in", async ({ page, request }, info) => {
  const tag = `${PREFIXO} ${info.project.name}`;
  const cpf = gerarCpf();

  // Empresa, e a mesma de novo (com outra caixa) para ver a mensagem de duplicada
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} Acme`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/empresas$/);
  await page.goto("/empresas/novo");
  await page.getByLabel("Nome").fill(`${tag} ACME`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Já existe uma empresa com esse nome")).toBeVisible();

  // Participante
  await page.goto("/participantes/novo");
  await page.getByLabel("Nome").fill(`${tag} José Conceição`);
  await page.getByLabel("CPF ou documento").fill(cpf);
  await page.getByLabel("Empresa").selectOption({ label: `${tag} Acme` });
  await page.getByLabel("Tipo").selectOption("vip");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/participantes$/);

  // Busca por CPF formatado e por nome sem acento
  await page.goto(`/participantes?q=${cpf.slice(0, 3)}.${cpf.slice(3, 6)}`);
  await expect(page.getByText(`${tag} José Conceição`)).toBeVisible();
  await page.goto(`/participantes?q=${encodeURIComponent(`${tag} jose conceicao`)}`);
  await expect(page.getByText(`${tag} José Conceição`)).toBeVisible();

  // Empresa com participante não apaga
  await page.goto(`/empresas?q=${encodeURIComponent(`${tag} Acme`)}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("Não dá para apagar")).toBeVisible();

  // Dois eventos: o QR do primeiro precisa ser recusado no segundo
  const criarEvento = async (nome: string) => {
    await page.goto("/eventos/novo");
    await page.getByLabel("Nome do evento").fill(nome);
    await page.getByLabel("Tipo").selectOption("kickoff");
    await page.getByLabel("Data").fill(hoje);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page).toHaveURL(/\/eventos\/[0-9a-f-]{36}$/);
    return page.url().split("/").pop()!;
  };
  const outroId = await criarEvento(`${tag} Outro`);
  const eventoId = await criarEvento(`${tag} Kickoff`);

  // Inscrever
  await page.getByRole("link", { name: "Inscrever participantes" }).click();
  await page.getByLabel("Buscar participante").fill(cpf);
  await page.getByRole("button", { name: "Buscar" }).click();
  await page.getByLabel(new RegExp(`${tag} José Conceição`)).check();
  await page.getByRole("button", { name: "Inscrever selecionados" }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${eventoId}$`));
  await expect(page.getByLabel("Presentes sobre inscritos")).toHaveText("0/1");

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
  await expect(page.getByLabel("Presentes sobre inscritos")).toHaveText("1/1");
});
```

- [ ] **Passo 2: Rodar.** `npx playwright install chromium`, depois `npm run e2e`. Esperado: 2 testes passando. Se algum seletor do E2E não achar o elemento, o problema está na tela, que mudou um rótulo do contrato da Tarefa 8, ou no teste. Decida qual dos dois e registre o motivo. Não afrouxe o teste para passar.

- [ ] **Passo 3: README.**

````markdown
# CRM de eventos

Cadastro de participantes e eventos, credencial em PDF com QR code e check-in no dia pelo celular.
Next.js na Vercel, Postgres no Supabase. Desenho completo em
`docs/superpowers/specs/2026-10-05-crm-eventos-design.md`.

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run dev                  # http://localhost:3000
```

Testes: `npm test` (unitários, Vitest) e `npm run e2e` (fluxo completo no navegador, Playwright).
O E2E grava no Supabase configurado no `.env.local` e apaga no fim tudo o que criou (prefixo `E2E `).
Na primeira vez: `npx playwright install chromium`.

## Banco

A migração fica em `supabase/migrations/`. Aplique pelo MCP do Supabase (`apply_migration`) ou colando
o SQL no SQL Editor do painel. Todas as tabelas têm RLS ligado **sem política**: a API pública do
Supabase não lê nada; só o servidor Next.js, com a chave secreta, acessa.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework Next.js, sem ajuste de build).
2. Em *Settings → Environment Variables*, cadastre as variáveis do `.env.example`.
3. Em *Settings → Deployment Protection*, ligue a proteção. Sem ela o sistema fica aberto na internet.
   - **Vercel Authentication + "All Deployments"**: protege inclusive o domínio de produção, em qualquer
     plano. Entra quem estiver logado numa conta Vercel com acesso ao projeto.
   - **Password Protection**: uma senha única para todos. Recurso do plano Pro (US$ 20/mês por projeto,
     conforme a documentação da Vercel em set/2026).
   - "Standard Protection" **não** protege o domínio de produção.
4. E-mail automático (opcional): crie a conta no Resend, verifique o domínio e preencha
   `RESEND_API_KEY` e `EMAIL_FROM`. O plano grátis envia 100 e-mails por dia; o sistema manda em lotes
   e o que passar da cota fica pendente para o dia seguinte.

## No dia do evento

Abra `/checkin` no celular (HTTPS é obrigatório para a câmera; a Vercel já serve em HTTPS) e aceite
a permissão da câmera. O evento do dia vem selecionado. Quem chegar sem QR legível é achado pela busca
por nome ou CPF na mesma tela. Leitor de código de barras USB também funciona: ele digita no campo de
código e manda Enter.
````

- [ ] **Passo 4: Verificação final.** Todos os comandos abaixo precisam estar limpos:

```powershell
& .\node_modules\.bin\tsc.cmd --noEmit -p .
& .\node_modules\.bin\eslint.cmd src e2e playwright.config.ts
& .\node_modules\.bin\vitest.cmd run      # 39 testes
npm run build
npm run e2e                               # 2 testes
```

Depois, uma busca por pendências: `TODO`, `FIXME`, `test.skip`, `.only` e `console.log`, que deve dar zero.

- [ ] **Passo 5: Commitar.** `git commit -m "Adiciona teste de ponta a ponta e instruções de deploy (#<issue>)"`

---

## Cobertura da spec

| spec | tarefa |
| --- | --- |
| Um login só pela proteção da Vercel | README da Tarefa 10, com a configuração no painel e sem código |
| QR com código aleatório por inscrição | 1 (coluna `codigo`), 2 (`gerarCodigo`), 6 (inscrição) |
| Participante em vários eventos; check-in por inscrição | 1 e 8 |
| PDF: baixar e enviar por e-mail | 5 e 9 |
| Formulário e planilha | 4 e 7 |
| Next.js na Vercel, Supabase só pelo servidor | 1 (`server-only`, RLS sem política) |
| MCP do Supabase | 1, passo 7 |
| Documento: CPF com dígito verificador ou passaporte | 2 |
| Busca sem acento, CPF sem pontuação | 2 (`normalizarBusca`, `nome_busca`) e 4 |
| Empresa com participante não apaga | 1 (`restrict`), 2 (`mensagemErro`), 4 e 10 |
| Check-in: verde, amarelo e vermelho; busca manual; seletor de evento | 8 e 10 |
| Erros legíveis; e-mail em lote com cota | 1, 4 e 9 |
| Vitest e Playwright em 1440 e 390 | todas; o E2E é a Tarefa 10 |

**Desvio da spec, para registrar no issue guarda-chuva.** A spec previa a extensão `unaccent` do Postgres. O plano usa a coluna `nome_busca`, preenchida pelo app com `normalizarBusca`. O resultado na busca é o mesmo, mas a regra fica testável no Vitest e o projeto não depende de extensão.
