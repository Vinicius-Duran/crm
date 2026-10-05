# Redesign do CRM no estilo AdminCN — Spec

> Data: 2026-10-05 · Autor: Vinicius Duran · Referência visual:
> https://shadcn-nextjs-admincn-admin-template.vercel.app/dashboard/sales (e `/datatable`)

## Objetivo

Trocar a casca e o visual do CRM pelo padrão do template AdminCN — menu lateral, barra superior em
card, conteúdo em cards e tabelas — **sem mudar o que nenhuma tela faz**.

## Decisões do autor

| # | Decisão | Observação |
|---|---|---|
| 1 | **Escopo: só casca e visual.** Nenhum dado novo, nenhuma consulta nova, nenhum painel de indicadores, nenhuma busca global. | Escolhida entre: só casca / casca + painel com gráficos / casca + painel + busca ⌘K. |
| 2 | **Cor: primária quase preta, acento verde-petróleo, tema claro e escuro.** | Igual ao template. |
| 3 | **Check-in em modo foco:** `/checkin` sem menu lateral nem barra superior. | É a tela da porta do evento, com câmera aberta. |
| 4 | **Abordagem: componente `Sidebar` oficial do shadcn + repaginar as telas existentes.** | Rejeitadas: copiar o código do AdminCN (licença incerta, muito componente sobrando) e casca feita à mão. |
| 5 | Envio de e-mail continua **parado**: a tela mantém o aviso de envio desligado, só repaginado. | Decisão do autor em 2026-10-05. |

## Fora de escopo

- Painel/dashboard com indicadores e gráficos; busca global ⌘K; notificações; avatar de usuário.
  Não há usuários: o acesso é a janela de usuário e senha do navegador (`src/proxy.ts`).
- Qualquer mudança em Server Action, rota de PDF/ZIP, schema, regra de domínio ou migração.
- As observações não bloqueantes dos reviews da fatia #12 (continuam candidatas a issue própria).
- Configuração do Resend.

## O que o template ensina (medido na página, não suposto)

- Menu lateral fixo de ~255 px, fundo levemente cinza (`lab(98)`), itens com ícone, grupos com
  título em caixa alta pequena ("DASHBOARD & LAYOUTS"), item ativo com fundo cinza arredondado.
- Barra superior **flutuante**: um card arredondado com borda, contendo botão de recolher menu à
  esquerda e ícones à direita.
- Fundo da página branco; todo conteúdo dentro de cards com borda fina, raio `0.625rem`, muito respiro.
- Fonte **Geist**; primária quase preta (`lab(7.78)`); acento verde-petróleo nos gráficos e badges.
- Tabela dentro de card: avatar de iniciais em círculo, nome em cima e e-mail embaixo em cinza,
  badge de status, menu "⋮" por linha, rodapé "Mostrando 1 a 5 de 25" com paginação.

## Desenho

### 1. Estrutura de rotas

As telas com casca passam para um **route group** `src/app/(painel)/`, que tem o próprio
`layout.tsx` com menu lateral e barra superior. **As URLs não mudam** — route group não entra no
caminho. `src/app/checkin/` fica **fora** do grupo e recebe layout próprio de modo foco.

```
src/app/layout.tsx              html, fonte, tema, Toaster — sem menu
src/app/(painel)/layout.tsx     SidebarProvider + menu lateral + barra superior
src/app/(painel)/eventos/…      (movido, mesmo conteúdo)
src/app/(painel)/participantes/…
src/app/(painel)/empresas/…
src/app/checkin/…               modo foco, sem casca
```

As rotas de arquivo (`inscricoes/[id]/pdf`, `eventos/[id]/zip`, `participantes/modelo`) não têm
layout e só mudam de pasta se o movimento do grupo exigir — o caminho público continua o mesmo.

### 2. Casca

- **Menu lateral** (`Sidebar` do shadcn, `collapsible="icon"`): cabeçalho com o nome "CRM de
  eventos"; grupo **Gestão** (Eventos, Participantes, Empresas); grupo **Operação** (Importar
  planilha, Check-in). Ícones lucide. Item ativo pelo caminho atual. No celular vira gaveta (o
  próprio `Sidebar` faz isso).
- **Barra superior**: card arredondado com o botão de recolher (`SidebarTrigger`), o breadcrumb da
  tela (ex.: Eventos › Feira 2026) e o botão de tema claro/escuro à direita.
- **Tema**: classe `dark` no `<html>`, escolhida pelo botão e lembrada no `localStorage`; um script
  curto no `<head>` aplica a classe antes da pintura para não piscar. Sem dependência nova.

### 3. Tokens

Em `globals.css`, ajustar as variáveis do shadcn, sem criar sistema paralelo:

- fonte: Inter → **Geist** (`next/font/google`), e remover a variável `--font-geist-mono` órfã
  apontada no review da #4;
- `--radius: 0.625rem`;
- `--primary` quase preta no claro e quase branca no escuro (o neutro do shadcn já é isso);
- novo par de acento verde-petróleo (`--chart-1`/badge de sucesso) com contraste AA nos dois temas;
- `--sidebar*` com o cinza claro do template.

### 4. Telas (14 `page.tsx`, todas repaginadas, nenhuma com lógica nova)

| Tela | Como fica |
|---|---|
| Listas (eventos, participantes, empresas) | Título + botão "Novo" no topo; card com busca/filtros e a tabela; participante com avatar de iniciais e e-mail embaixo do nome; ações por linha num menu "⋮" (editar, PDF, apagar). |
| Formulários (novo/editar de cada entidade, inscrever) | Card com título e grade de campos em duas colunas no desktop, uma no celular; botões no rodapé do card. |
| Detalhe do evento | Três cards pequenos no topo — inscritos, presentes, faltam — com números que a página **já calcula** (`presentes` em `eventos/[id]/page.tsx`); depois a tabela de inscrições com badges de check-in e de e-mail. |
| Importar planilha | Card de envio do arquivo; prévia com os três números (novos, já cadastrados, com erro) em badges e a lista de erros por linha. |
| Check-in (modo foco) | Tela cheia: seletor de evento no topo (o de hoje já vem escolhido), câmera ao centro, resultado verde/amarelo/vermelho ocupando a largura, busca manual embaixo, botão discreto "Voltar ao painel". |
| Início (`/`) | Continua redirecionando para `/eventos`. |

**Os textos e rótulos que o E2E usa não mudam** (`e2e/fluxo.spec.ts` tem 35 chamadas `getBy…` por papel,
rótulo e texto). Se um rótulo precisar mudar, o teste muda junto, no mesmo commit, e isso é
registrado.

### 5. Movimento

Pouco e com propósito, com GSAP ou anime.js (regra do autor), só `transform`/`opacity`, e
respeitando `prefers-reduced-motion`:

- resultado do check-in entra com escala e opacidade curtas (é a única resposta que a pessoa na porta
  precisa ver de relance);
- nada de animação de entrada em listas e formulários — é ferramenta de trabalho.

Quem esconde para revelar é o JS (`gsap.from`), nunca o CSS.

### 6. Componentes

Do registro shadcn, instalados pela CLI: `sidebar` (com `separator`, `sheet`, `tooltip`, `skeleton`
e o que mais a CLI trouxer como dependência dele), `dropdown-menu`, `avatar`, `breadcrumb`. Reaproveitar `Campo`,
`Selecao` e `BotaoApagar` existentes, repaginados — não duplicar.

## Verificação

- `tsc`, `eslint`, Vitest (39 testes, contagem não muda) e `npm run build` limpos.
- **E2E verde** (`npm run e2e`, desktop e celular) — é a prova de que nenhuma tela perdeu função.
- Playwright MCP em **1440 e 390**, **claro e escuro**, em todas as 14 telas, com console sem erro.
- As cinco skills de front do autor (taste-skill, refero, emil-design-eng, impeccable, 21st.dev);
  o refero devolve `NO_SUBSCRIPTION` nesta conta — registrar e seguir.
- Contraste AA do acento verde-petróleo medido nos dois temas.

## Riscos

| Risco | Mitigação |
|---|---|
| Mover pastas para `(painel)` quebrar import relativo ou rota | `tsc` + `build` + E2E; mover com `git mv` para preservar histórico. |
| Rótulo mudar e o E2E falhar | Manter os textos; quando mudar, ajustar o teste no mesmo commit. |
| Tema escuro piscar no carregamento | Script de tema no `<head>`, antes da pintura. |
| Menu "⋮" esconder ação que o E2E clica | O E2E abre o menu antes de clicar, ou a ação fica também visível — decidir no plano, tela a tela. |
