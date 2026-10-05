# Redesign no estilo AdminCN — Plano de implementação

> **Para agentes:** a execução é pelo agente `coordenador` (`/realizar-tarefas`), uma issue por tarefa.
> Passos com checkbox (`- [ ]`).

**Objetivo:** trocar a casca e o visual do CRM pelo padrão do template AdminCN (menu lateral, barra
superior em card, conteúdo em cards e tabelas), sem mudar o que nenhuma tela faz.

**Arquitetura:** um componente cliente `Casca` no layout raiz desenha menu lateral (shadcn `Sidebar`)
e barra superior em toda tela, menos em `/checkin` (modo foco). Tokens de cor e fonte mudam no
`globals.css`. Cada tela é repaginada com os componentes shadcn que já existem; nenhuma Server Action,
rota de arquivo, schema ou regra de domínio muda.

**Stack:** Next.js 16.3.8, React 19, shadcn (style `base-nova`, Base UI), Tailwind 4, lucide, GSAP.

**Spec:** `docs/superpowers/specs/2026-10-05-redesign-admincn-design.md` — leia antes; o plano
argumenta a partir dela.

## Restrições globais

- **Nenhuma lógica nova.** Server Actions, rotas de PDF/ZIP/modelo, `src/lib/*` de domínio, schema e
  migração não mudam. Exceção única: `iniciais()` em `src/lib/texto.ts` (Tarefa 2), puramente visual.
- **Nenhuma pasta de rota muda de lugar.** Route group `(painel)` foi testado e **reprovado**: no
  `next dev` ele faz `/eventos/[id]/inscrever` e `/eventos/[id]/editar` responderem 404.
- **Os rótulos e textos que o E2E usa não mudam** — tabela na seção "Contrato com o E2E". Se um
  precisar mudar, `e2e/fluxo.spec.ts` muda no mesmo commit e o desvio vai para o `IMPLEMENTACAO.md`.
- **Ações de linha ficam visíveis** (botões pequenos), sem menu "⋮": o E2E clica "Apagar" e "PDF"
  direto na linha.
- **Selects continuam nativos** (`Selecao` / `<select>`): o E2E usa `selectOption` em "Empresa",
  "Tipo" e "Evento".
- Cor de sucesso/acento: token `--sucesso` (classe `bg-sucesso`, `text-sucesso`,
  `text-sucesso-foreground`). Nada de cor hexadecimal ou `teal-*` solto no JSX.
- Fonte Geist; `font-mono` (Geist Mono) continua no código do QR e no CPF — **a classe `font-mono` no
  código do QR é usada pelo E2E** (`linha.locator(".font-mono")`).
- Movimento só com GSAP, só `transform`/`opacity`, sempre atrás de
  `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`; quem esconde para revelar é o JS
  (`gsap.from`), nunca o CSS. Só o resultado do check-in anima (Tarefa 6).
- Tarefa com tela: as cinco skills de front do autor, na ordem — `taste-skill:redesign-skill`,
  refero (o MCP devolve `NO_SUBSCRIPTION` nesta conta: registrar e seguir), `emil-design-eng`,
  `impeccable:impeccable`, 21st.dev — e Playwright MCP em **1440 e 390**, **claro e escuro**, console
  sem erro. Registrar no `IMPLEMENTACAO.md` a passagem por cada skill.
- O aviso de hidratação com `style={{caret-color:"transparent"}}` em `<input>` **é do Playwright MCP**
  (esconde o cursor no screenshot), não do app: ignorar só esse.
- Comandos pelo PowerShell, binários de `node_modules\.bin` (ver `.claude/contexto-empresa.md`). O E2E
  precisa de `.env.local` com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, e **sem** `ADMIN_USER` /
  `ADMIN_PASSWORD` (em dev, sem eles, o sistema abre sem senha). O banco tem dado real do autor (ex.:
  "Teste Evento"): não apague nada que o teste não criou.
- Números de referência, **medidos**: 14 `page.tsx`; Vitest 42 hoje → 47 após a Tarefa 1 → 50 após
  a Tarefa 2; E2E 2 testes (desktop e celular).
- **Prefira perguntar a inventar número.** Se uma medida, cor ou contagem não estiver aqui, registre a
  dúvida em vez de supor.

## Contrato com o E2E

`e2e/fluxo.spec.ts` (35 chamadas `getBy…`). Cada linha abaixo precisa continuar valendo depois da
tarefa dona da tela:

| Tela | O que o teste usa | Tarefa |
|---|---|---|
| `/empresas/novo` | rótulo "Nome"; botão "Salvar"; redireciona para `/empresas`; texto "Já existe uma empresa com esse nome" | 3 |
| `/participantes/novo` | rótulos "Nome", "CPF ou documento", "Empresa" (select), "Tipo" (select); botão "Salvar"; redireciona para `/participantes` | 3 |
| `/participantes?q=…` | o nome do participante visível na lista | 2 |
| `/empresas?q=…` | botão **"Apagar"** na linha (com `confirm` nativo); texto "Não dá para apagar" | 2 |
| `/eventos/novo` | rótulos "Nome do evento", "Tipo" (select), "Data"; botão "Salvar"; redireciona para `/eventos/<uuid>` | 3 |
| `/eventos/<id>` | link "Inscrever participantes"; elemento com `aria-label="Presentes sobre inscritos"` cujo texto é exatamente `0/1` e depois `1/1`; linha da tabela (`role=row`) com o nome, contendo célula `.font-mono` com o código e link **"PDF"** | 4 |
| `/eventos/<id>/inscrever` | rótulo "Buscar participante"; botão "Buscar"; checkbox rotulado com o nome; botão "Inscrever selecionados"; volta para `/eventos/<id>` | 3 |
| `/checkin` | select "Evento"; campo "Código do QR"; botão "Validar"; textos "Check-in feito · entregar crachá", "Já fez check-in às …", "Código não encontrado", "QR de outro evento" | 6 |

## Foco da revisão

Situações que a spec implica e nenhum teste da suíte cobre hoje, da mais provável à menos:

1. **Gaveta do menu no celular deve fechar ao escolher um item.** O `Sidebar` do shadcn não fecha
   sozinho; sem isso, a pessoa navega e continua vendo o menu por cima. Coberto na Tarefa 1 (código +
   verificação no Playwright MCP).
2. **Item ativo em sub-rota com prefixo comum:** em `/participantes/importar` deve acender "Importar
   planilha", não "Participantes"; em `/eventosx` nada acende. Teste em `navegacao.test.ts` (Tarefa 1).
3. **Tema escuro não pode piscar claro** ao navegar ou recarregar. Script no `<head>` (Tarefa 1);
   verificar recarregando a página no escuro.
4. **Nome com acento ou com uma palavra só no avatar** ("Érica Ávila" → "ÉÁ"; "Ana" → "A"; vazio →
   "?"). Teste em `texto.test.ts` (Tarefa 2).
5. **Pessoa com `prefers-reduced-motion`** não vê animação no check-in — e o cartão do resultado
   aparece inteiro mesmo assim. Tarefa 6, verificado com `browser_emulate_media`.

---

### Tarefa 1: Casca, tema e tokens

**Arquivos:**
- Criar (CLI shadcn): `src/components/ui/sidebar.tsx`, `separator.tsx`, `sheet.tsx`, `tooltip.tsx`,
  `skeleton.tsx`, `breadcrumb.tsx`, `avatar.tsx`, `src/hooks/use-mobile.ts`
- Reescrever: `src/hooks/use-mobile.ts`
- Criar: `src/lib/navegacao.ts`, `src/lib/navegacao.test.ts`, `src/components/menu-lateral.tsx`,
  `src/components/barra-superior.tsx`, `src/components/casca.tsx`
- Modificar: `src/app/layout.tsx`, `src/app/globals.css`, `playwright.config.ts`

**Interfaces:**
- Produz: `GRUPOS`, `itemAtivo(caminho: string): string | undefined`,
  `trilha(caminho: string): { href: string; texto: string }[]` em `@/lib/navegacao`;
  `Casca({ children })` em `@/components/casca`; classes Tailwind `bg-sucesso`, `text-sucesso`,
  `text-sucesso-foreground`, `bg-sucesso/10`.

- [ ] **Passo 1: Instalar os componentes**

Run: `npx shadcn@latest add sidebar breadcrumb avatar --yes`
Expected: cria os 7 arquivos de `src/components/ui/` listados acima e `src/hooks/use-mobile.ts`;
pula `button.tsx` e `input.tsx` ("files might be identical"); `package.json` **não** muda.

- [ ] **Passo 2: Ver o lint reprovar o hook gerado**

Run: `& .\node_modules\.bin\eslint.cmd src`
Expected: FAIL — `src/hooks/use-mobile.ts` `react-hooks/set-state-in-effect`.

- [ ] **Passo 3: Reescrever `src/hooks/use-mobile.ts`**

```ts
import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const CONSULTA = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function assinar(avisar: () => void) {
  const mql = window.matchMedia(CONSULTA);
  mql.addEventListener("change", avisar);
  return () => mql.removeEventListener("change", avisar);
}

// Lê a largura direto do navegador, sem setState em efeito (regra react-hooks/set-state-in-effect).
export function useIsMobile() {
  return React.useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
```

- [ ] **Passo 4: Escrever o teste da navegação** — `src/lib/navegacao.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { itemAtivo, trilha } from "./navegacao";

describe("itemAtivo", () => {
  it("acende o item da rota e das sub-rotas", () => {
    expect(itemAtivo("/eventos")).toBe("/eventos");
    expect(itemAtivo("/eventos/123/inscrever")).toBe("/eventos");
  });

  it("prefere o prefixo mais longo", () => {
    expect(itemAtivo("/participantes/importar")).toBe("/participantes/importar");
    expect(itemAtivo("/participantes/novo")).toBe("/participantes");
  });

  it("não confunde prefixo de texto com rota", () => {
    expect(itemAtivo("/eventosx")).toBeUndefined();
    expect(itemAtivo("/")).toBeUndefined();
  });
});

describe("trilha", () => {
  it("nomeia os segmentos conhecidos e chama o id de Detalhe", () => {
    expect(trilha("/eventos/4f1c/inscrever")).toEqual([
      { href: "/eventos", texto: "Eventos" },
      { href: "/eventos/4f1c", texto: "Detalhe" },
      { href: "/eventos/4f1c/inscrever", texto: "Inscrever" },
    ]);
  });

  it("raiz não tem passos", () => {
    expect(trilha("/")).toEqual([]);
  });
});
```

- [ ] **Passo 5: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/navegacao.test.ts`
Expected: FAIL — não acha o módulo `./navegacao`.

- [ ] **Passo 6: Implementar `src/lib/navegacao.ts`**

```ts
// Itens do menu lateral, em grupos. Os ícones ficam no componente; aqui só caminho e texto.
export const GRUPOS = [
  {
    titulo: "Gestão",
    itens: [
      { href: "/eventos", texto: "Eventos" },
      { href: "/participantes", texto: "Participantes" },
      { href: "/empresas", texto: "Empresas" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/participantes/importar", texto: "Importar planilha" },
      { href: "/checkin", texto: "Check-in" },
    ],
  },
] as const;

const TODOS: string[] = GRUPOS.flatMap((g) => g.itens.map((i) => i.href));

// Ativo é o item cujo caminho é o prefixo mais longo da rota atual:
// em /participantes/importar acende "Importar planilha", e não "Participantes".
export function itemAtivo(caminho: string): string | undefined {
  return TODOS.filter((h) => caminho === h || caminho.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
}

const NOMES: Record<string, string> = {
  eventos: "Eventos",
  participantes: "Participantes",
  empresas: "Empresas",
  importar: "Importar planilha",
  novo: "Novo",
  editar: "Editar",
  inscrever: "Inscrever",
};

// Cada segmento da URL vira um passo do breadcrumb; segmento desconhecido (o id) vira "Detalhe".
export function trilha(caminho: string): { href: string; texto: string }[] {
  const partes = caminho.split("/").filter(Boolean);
  return partes.map((p, i) => ({ href: "/" + partes.slice(0, i + 1).join("/"), texto: NOMES[p] ?? "Detalhe" }));
}
```

- [ ] **Passo 7: Rodar e ver passar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/navegacao.test.ts`
Expected: PASS, 5 testes.

- [ ] **Passo 8: Criar `src/components/menu-lateral.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, FileSpreadsheet, QrCode, Users, type LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { GRUPOS, itemAtivo } from "@/lib/navegacao";

const ICONES: Record<string, LucideIcon> = {
  "/eventos": CalendarDays,
  "/participantes": Users,
  "/empresas": Building2,
  "/participantes/importar": FileSpreadsheet,
  "/checkin": QrCode,
};

export function MenuLateral() {
  const ativo = itemAtivo(usePathname());
  // No celular o menu é uma gaveta: fecha ao escolher um item.
  const { setOpenMobile } = useSidebar();
  const fechar = () => setOpenMobile(false);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/eventos" onClick={fechar} />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <QrCode className="size-4" />
              </span>
              <span className="grid leading-tight">
                <span className="font-semibold">CRM de eventos</span>
                <span className="text-xs text-muted-foreground">Credenciamento</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {GRUPOS.map((g) => (
          <SidebarGroup key={g.titulo}>
            <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.itens.map(({ href, texto }) => {
                  const Icone = ICONES[href];
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={ativo === href}
                        tooltip={texto}
                        render={<Link href={href} onClick={fechar} />}
                      >
                        <Icone />
                        <span>{texto}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
```

- [ ] **Passo 9: Criar `src/components/barra-superior.tsx`**

```tsx
"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { trilha } from "@/lib/navegacao";

function alternarTema() {
  const escuro = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("tema", escuro ? "escuro" : "claro");
  } catch {}
}

export function BarraSuperior() {
  const passos = trilha(usePathname());
  return (
    <header className="sticky top-3 z-10 mx-3 mt-3 flex h-14 items-center gap-2 rounded-xl border bg-background/95 px-3 backdrop-blur md:mx-6">
      <SidebarTrigger aria-label="Recolher menu" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {passos.map((p, i) => (
            <Fragment key={p.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="truncate">
                {i === passos.length - 1 ? (
                  <BreadcrumbPage>{p.texto}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={p.href} />}>{p.texto}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <Button variant="ghost" size="icon-sm" onClick={alternarTema} aria-label="Alternar tema claro e escuro">
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </header>
  );
}
```

- [ ] **Passo 10: Criar `src/components/casca.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { BarraSuperior } from "@/components/barra-superior";
import { MenuLateral } from "@/components/menu-lateral";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Menu lateral e barra superior em todas as telas, menos no check-in, que é tela cheia (modo foco).
export function Casca({ children }: { children: React.ReactNode }) {
  if (usePathname().startsWith("/checkin")) return <main className="mx-auto w-full max-w-2xl px-4 py-6">{children}</main>;
  return (
    <SidebarProvider>
      <MenuLateral />
      <SidebarInset>
        <BarraSuperior />
        <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Passo 11: Substituir `src/app/layout.tsx` inteiro**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Casca } from "@/components/casca";
import "./globals.css";

const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "CRM de eventos" };

// Toda tela lê o banco na hora; nada é pré-renderizado no build.
export const dynamic = "force-dynamic";

// Aplica o tema salvo antes da pintura, para a tela não piscar clara no modo escuro.
const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");if(t==="escuro"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <TooltipProvider>
          <Casca>{children}</Casca>
        </TooltipProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
```

- [ ] **Passo 12: Tokens em `src/app/globals.css`** — editar linha a linha (Edit), **sem reescrever o
  arquivo**: o arquivo tem fim de linha CRLF, e `sed` ou reescrita converte tudo e polui o diff.

1. No bloco `@theme inline`, logo depois de `  --color-chart-1: var(--chart-1);`, acrescentar:
   ```css
     --color-sucesso: var(--sucesso);
     --color-sucesso-foreground: var(--sucesso-foreground);
   ```
2. No bloco `:root`, trocar `  --chart-1: oklch(0.87 0 0);` por:
   ```css
     --chart-1: oklch(0.511 0.096 186.391);
     --sucesso: oklch(0.511 0.096 186.391);
     --sucesso-foreground: oklch(0.985 0 0);
   ```
3. No bloco `.dark`, trocar `  --chart-1: oklch(0.87 0 0);` por:
   ```css
     --chart-1: oklch(0.777 0.152 181.912);
     --sucesso: oklch(0.777 0.152 181.912);
     --sucesso-foreground: oklch(0.205 0 0);
   ```
4. No bloco `.dark`, trocar `  --sidebar-primary: oklch(0.488 0.243 264.376);` por
   `  --sidebar-primary: oklch(0.922 0 0);` e `  --sidebar-primary-foreground: oklch(0.985 0 0);` por
   `  --sidebar-primary-foreground: oklch(0.205 0 0);`.

`--radius` já é `0.625rem` e os `--sidebar*` claros já existem: não mexer.
Contraste medido: teal-700 dá 5,47:1 sobre branco e 4,76:1 em `bg-sucesso/10`; teal-400 dá 10,64:1
sobre o fundo escuro.

- [ ] **Passo 13: `playwright.config.ts`** — logo depois da linha `  timeout: 60_000,`, acrescentar:

```ts
  // O `next dev` compila cada rota no primeiro acesso; 5 s (o padrão) não cobre a primeira gravação.
  expect: { timeout: 15_000 },
```

Medido: com `.next` apagado, "Salvar" em `/eventos/novo` ficou em "Salvando…" por mais de 5 s e o
`toHaveURL` falhou; com 15 s, verde.

- [ ] **Passo 14: Verificação completa**

Run (PowerShell):
```
& .\node_modules\.bin\tsc.cmd --noEmit -p .
& .\node_modules\.bin\eslint.cmd src e2e playwright.config.ts
& .\node_modules\.bin\vitest.cmd run
npm run build
npm run e2e
```
Expected: tsc e eslint sem erro; Vitest **47** passando; build lista as mesmas 17 rotas de antes (mais `/_not-found`);
E2E **2 passed**. Se `tsc` acusar `.next/dev/types/validator.ts`, é arquivo gerado por um `next dev`
rodando em paralelo: pare o servidor, apague `.next` e rode de novo.

- [ ] **Passo 15: Playwright MCP**

Com `npm run dev`: em 1440 e 390, claro e escuro, abrir `/eventos`, `/participantes/importar` e
`/checkin`. Conferir: item ativo correto (em `/participantes/importar`, só "Importar planilha");
breadcrumb; alternar tema e **recarregar** — continua escuro, sem piscar; em 390, abrir a gaveta pelo
botão "Recolher menu", tocar "Empresas" e confirmar que a URL mudou **e a gaveta fechou**; `/checkin`
sem menu e sem barra.

- [ ] **Passo 16: Commit**

```bash
git add src/components src/hooks src/lib/navegacao.ts src/lib/navegacao.test.ts src/app/layout.tsx src/app/globals.css playwright.config.ts
git commit -m "Adiciona menu lateral, barra superior e tema claro e escuro (#N)"
```

---

### Tarefa 2: Listas — eventos, participantes e empresas

**Arquivos:**
- Modificar: `src/lib/texto.ts`, `src/lib/texto.test.ts`, `src/app/eventos/page.tsx`,
  `src/app/participantes/page.tsx`, `src/app/empresas/page.tsx`
- Pode modificar: `src/components/botao-apagar.tsx` (só visual)

**Interfaces:**
- Consome: tokens `--sucesso` e a `Casca` da Tarefa 1; `Avatar`, `AvatarFallback` de
  `@/components/ui/avatar` (instalado na Tarefa 1); `Badge`, `Card`, `Table` já existentes.
- Produz: `iniciais(nome: string): string` em `@/lib/texto`.

- [ ] **Passo 1: Teste de `iniciais`** — em `src/lib/texto.test.ts`, trocar o import
  `import { escaparHtml, limparTermo, normalizarBusca } from "./texto";` por
  `import { escaparHtml, iniciais, limparTermo, normalizarBusca } from "./texto";` e acrescentar no fim:

```ts

describe("iniciais", () => {
  it("usa o primeiro e o último nome", () => {
    expect(iniciais("José da Conceição")).toBe("JC");
    expect(iniciais("  maria   souza ")).toBe("MS");
  });

  it("nome único dá uma letra, vazio dá ?", () => {
    expect(iniciais("Ana")).toBe("A");
    expect(iniciais("   ")).toBe("?");
  });

  it("mantém o acento da inicial", () => {
    expect(iniciais("Érica Ávila")).toBe("ÉÁ");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `& .\node_modules\.bin\vitest.cmd run src/lib/texto.test.ts`
Expected: FAIL — `iniciais` não é exportado.

- [ ] **Passo 3: Implementar** — acrescentar ao fim de `src/lib/texto.ts`:

```ts

// Avatar das listas: primeira letra do primeiro e do último nome, em maiúscula ("José da Conceição" → "JC").
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR");
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `& .\node_modules\.bin\vitest.cmd run`
Expected: **50** testes passando.

- [ ] **Passo 5: Repaginar as três listas**, seguindo a spec (seção 4) e a tela `/datatable` do
  template. Para cada uma das três `page.tsx`:
  - cabeçalho: título `h1` + descrição curta em `text-muted-foreground` à esquerda, botão primário
    "Novo …" (mesmo texto de hoje) à direita;
  - um `Card` com a busca/filtros no topo (mesmos `name` de input e mesmos parâmetros de URL de hoje)
    e a tabela dentro;
  - participantes: primeira coluna com `Avatar` de `iniciais(nome)` + nome em cima e e-mail embaixo
    em `text-muted-foreground`; CPF continua em `font-mono`;
  - eventos: tipo como `Badge` `variant="secondary"`; contagem de inscritos alinhada à direita com
    `tabular-nums`;
  - empresas: o botão **"Apagar"** continua na linha, visível, com o mesmo `confirm` e a mesma
    mensagem "Não dá para apagar" (contrato do E2E);
  - lista vazia: linha única com texto em `text-muted-foreground` (já existe; manter as frases).
  Nenhuma consulta muda: só JSX e classes.

- [ ] **Passo 6: Verificação** — os mesmos cinco comandos do Passo 14 da Tarefa 1 (Vitest **50**,
  E2E **2 passed**) e Playwright MCP nas três listas em 1440/390 × claro/escuro, com busca preenchida
  e com lista vazia.

- [ ] **Passo 7: Commit**

```bash
git add src/lib/texto.ts src/lib/texto.test.ts src/app/eventos/page.tsx src/app/participantes/page.tsx src/app/empresas/page.tsx src/components/botao-apagar.tsx
git commit -m "Repagina as listas de eventos, participantes e empresas (#N)"
```

---

### Tarefa 3: Formulários — novo, editar e inscrever

**Arquivos:**
- Modificar: `src/components/campo.tsx`, `src/app/empresas/formulario.tsx`,
  `src/app/empresas/novo/page.tsx`, `src/app/empresas/[id]/page.tsx`,
  `src/app/participantes/formulario.tsx`, `src/app/participantes/novo/page.tsx`,
  `src/app/participantes/[id]/page.tsx`, `src/app/eventos/formulario.tsx`,
  `src/app/eventos/novo/page.tsx`, `src/app/eventos/[id]/editar/page.tsx`,
  `src/app/eventos/[id]/inscrever/page.tsx`

**Interfaces:**
- Consome: Tarefa 1 (casca, tokens). `Campo` e `Selecao` continuam com a mesma assinatura — só o
  visual muda.

- [ ] **Passo 1: Repaginar**, seguindo a spec (seção 4):
  - cada formulário dentro de um `Card` com `CardHeader` (título igual ao `h1` de hoje) e
    `CardContent`;
  - campos em grade: `grid gap-4 md:grid-cols-2`; campos longos (nome, observação) ocupam as duas
    colunas;
  - botões no rodapé do card (`CardFooter`), "Salvar" primário à direita e "Cancelar"/voltar como
    `variant="ghost"`, se já existir hoje;
  - mensagens de erro de campo e de duplicidade continuam com o **mesmo texto**;
  - `Selecao` continua `<select>` nativo, só com classe que combine com o `Input`;
  - inscrever: busca em linha (campo + botão "Buscar"), lista de resultados com checkbox **rotulado
    pelo nome** e o botão "Inscrever selecionados" no rodapé.
  - Manter a convenção de `key` por campo com `defaultValue` (commits `26cb92b` e `6c7b871`).

- [ ] **Passo 2: Verificação** — os cinco comandos (Vitest **50**, E2E **2 passed**) e Playwright MCP
  em todas as telas da lista acima, 1440/390 × claro/escuro, inclusive com erro de validação visível
  (enviar o formulário vazio) e com a mensagem de duplicidade.

- [ ] **Passo 3: Commit**

```bash
git add src/components/campo.tsx src/app/empresas src/app/participantes src/app/eventos
git commit -m "Repagina os formulários de cadastro, edição e inscrição (#N)"
```

---

### Tarefa 4: Detalhe do evento

**Arquivos:**
- Modificar: `src/app/eventos/[id]/page.tsx`, `src/app/eventos/[id]/envio-email.tsx` (só visual)

**Interfaces:**
- Consome: Tarefa 1 (casca, tokens `--sucesso`). Usa só o que a página já carrega: `inscricoes` e
  `presentes` (`src/app/eventos/[id]/page.tsx`, hoje na linha 37).

- [ ] **Passo 1: Repaginar**, seguindo a spec (seção 4):
  - cabeçalho com nome, tipo (`Badge`) e data do evento; ações à direita: "Inscrever participantes"
    (link, mesmo texto), "Editar", baixar ZIP, apagar evento;
  - três cards pequenos: **Inscritos** (`inscricoes.length`), **Presentes** (`presentes`), **Faltam**
    (`inscricoes.length - presentes`). O elemento com `aria-label="Presentes sobre inscritos"` e texto
    exato `{presentes}/{inscricoes.length}` **continua existindo** (pode ficar dentro do card
    Presentes);
  - tabela de inscrições em `Card`: nome com `Avatar` de `iniciais`, célula do código **com a classe
    `font-mono`**, coluna de check-in como `Badge` (`bg-sucesso/10 text-sucesso` com a hora quando
    houve; `variant="outline"` "Pendente" quando não), coluna de e-mail igual a hoje, link **"PDF"**
    visível na linha, remover inscrição visível;
  - aviso de e-mail desligado (`envio-email.tsx`) continua, só repaginado — o envio está parado por
    decisão do autor.

- [ ] **Passo 2: Verificação** — os cinco comandos (E2E **2 passed**: ele confere `0/1`, depois
  `1/1`, a célula `.font-mono` e o link "PDF") e Playwright MCP em 1440/390 × claro/escuro, com evento
  sem inscritos e com inscritos.

- [ ] **Passo 3: Commit**

```bash
git add "src/app/eventos/[id]/page.tsx" "src/app/eventos/[id]/envio-email.tsx"
git commit -m "Repagina o detalhe do evento com resumo de presença (#N)"
```

---

### Tarefa 5: Importar planilha

**Arquivos:**
- Modificar: `src/app/participantes/importar/page.tsx`, `src/app/participantes/importar/importador.tsx`

**Interfaces:**
- Consome: Tarefa 1. A prévia já entrega `previa.novos`, `previa.existentes`, `previa.comErro` e
  `previa.linhas` (`importador.tsx`, linhas 54–59 hoje).

- [ ] **Passo 1: Repaginar**, seguindo a spec (seção 4):
  - `Card` de envio: instrução das colunas (mesmo texto, nomes de coluna em `font-mono`), link "Baixar
    o modelo", campo de arquivo estilizado como `Input`, select de evento (nativo), botão "Ver prévia";
  - `Card` da prévia: os três números como `Badge` (novos com `bg-sucesso/10 text-sucesso`, já
    cadastrados `variant="secondary"`, com erro `variant="destructive"` só quando `> 0`), lista de
    erros por linha, botão de confirmar com a mesma regra de desabilitar de hoje.

- [ ] **Passo 2: Verificação** — os cinco comandos e Playwright MCP em 1440/390 × claro/escuro,
  importando um CSV fictício com uma linha boa, uma repetida e uma com erro (sem confirmar a gravação,
  ou apagando depois o que gravar).

- [ ] **Passo 3: Commit**

```bash
git add src/app/participantes/importar
git commit -m "Repagina a importação de planilha (#N)"
```

---

### Tarefa 6: Check-in em modo foco

**Arquivos:**
- Modificar: `package.json`, `package-lock.json` (gsap), `src/app/checkin/page.tsx`,
  `src/app/checkin/leitor.tsx`

**Interfaces:**
- Consome: `Casca` da Tarefa 1, que já devolve `/checkin` sem menu e sem barra, dentro de
  `<main className="mx-auto w-full max-w-2xl px-4 py-6">`.

- [ ] **Passo 1: Instalar o GSAP**

Run: `npm i gsap`
Expected: `package.json` ganha `"gsap": "^3.15.0"` (versão medida em 2026-10-05); lockfile com 1
pacote novo.

- [ ] **Passo 2: Animar a entrada do resultado** — em `src/app/checkin/leitor.tsx`:
  1. trocar `import { useEffect, useRef, useState, useTransition } from "react";` por
     `import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";` e, na linha
     seguinte, acrescentar `import gsap from "gsap";`;
  2. no começo de `function Cartao({ r }: { r: ResultadoCheckin }) {`, antes do `return`:

```tsx
  const caixa = useRef<HTMLDivElement>(null);
  // Cada resultado entra com um "pulo" curto; quem prefere menos movimento vê o cartão direto.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(caixa.current, { scale: 0.96, opacity: 0, duration: 0.22, ease: "power2.out" });
    });
    return () => mm.revert();
  }, [r]);
```

  3. no `<div role="status" aria-live="assertive" …>` do `Cartao`, acrescentar `ref={caixa}`.

- [ ] **Passo 3: Repaginar o modo foco**, seguindo a spec (seção 4):
  - topo: link discreto "Voltar ao painel" (para `/eventos`) e o select "Evento" (nativo, mesmo
    rótulo);
  - câmera ao centro, em `Card`, com cantos arredondados;
  - campo "Código do QR" + botão "Validar" em linha;
  - o `Cartao` de resultado ocupa a largura toda, com os **mesmos textos**; as cores podem migrar para
    tokens, mantendo verde/âmbar/vermelho distintos e AA nos dois temas;
  - busca manual embaixo, em `Card`.

- [ ] **Passo 4: Verificação** — os cinco comandos (E2E **2 passed**: ele confere os quatro textos de
  resultado) e Playwright MCP em 1440/390 × claro/escuro: validar um código desconhecido e ver o
  cartão vermelho entrar; repetir com `browser_emulate_media` em `reducedMotion: "reduce"` e confirmar
  que o cartão aparece inteiro, sem animação.

- [ ] **Passo 5: Commit**

```bash
git add package.json package-lock.json src/app/checkin
git commit -m "Coloca o check-in em modo foco e anima o resultado (#N)"
```
