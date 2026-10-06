# Evento por empresa, CSV do evento, PDF completo e importação no celular — Spec

> Data: 2026-10-06 · Autor: Vinicius Duran

## Objetivo

Reorganizar o CRM na ordem em que o trabalho acontece — **empresa → evento → participantes**, um
evento por vez — e, a partir do evento, exportar tudo em CSV, gerar uma credencial em PDF mais
completa e importar planilha sem quebrar no celular.

## Decisões do autor

| # | Decisão | Observação |
|---|---|---|
| 1 | **O participante pertence ao evento.** A mesma pessoa em dois eventos são dois cadastros; o CPF só é único dentro do evento. | Rejeitado: participante global único por CPF com inscrição por evento (o modelo de hoje). |
| 2 | **Rodapé do PDF assina as duas:** `© 2026 <Empresa cliente> · Organização VM Events. Todos os direitos reservados.` | Rejeitados: só a marca VM Events; só a empresa cliente. |
| 3 | **Tipos de participante não mudam** (Palestrante, VIP, Autoridade, Convidado). A planilha do cliente que usa "Organizador" e "Padrão" é corrigida na planilha. | O autor recusou acrescentar os dois tipos. |
| 4 | Envio de e-mail continua **parado** (decisão de 2026-10-05); só é adaptado à tabela nova. | |

## Fora de escopo

- Tipos novos de participante.
- Histórico de uma pessoa entre eventos, busca global de participantes.
- Conceito de "evento ativo" travado no sistema: "um evento por vez" é como a equipe trabalha, não
  uma regra do banco. A lista de eventos continua existindo.
- Ligar o envio de e-mail.

## 1. Dados

Produção em 2026-10-06: 1 empresa, 0 eventos, 0 participantes, 0 inscrições (medido no Supabase).
Por isso a migração recria as tabelas em vez de migrar linhas.

Migração nova (`supabase/migrations/<timestamp>_evento_por_empresa.sql`):

- `drop table inscricoes; drop table participantes;`
- `eventos` ganha `empresa_id uuid not null references empresas (id) on delete restrict`, com índice.
  Apagar empresa que tem evento é recusado; a tela mostra o erro.
- `participantes` recriada, já com o que era da inscrição:

| coluna | tipo | regra |
|---|---|---|
| `id` | uuid | pk |
| `evento_id` | uuid | not null, `references eventos on delete cascade`, índice |
| `nome`, `nome_busca` | text | como hoje |
| `documento` | text | not null, mesmo check de hoje; **`unique (evento_id, documento)`** |
| `data_nascimento`, `email`, `telefone` | | como hoje |
| `empresa` | text | **texto livre**, onde a pessoa trabalha; opcional |
| `tipo` | `tipo_participante` | not null |
| `codigo` | text | not null, `unique` global (o check-in procura só pelo código) |
| `checkin_em`, `email_enviado_em`, `email_erro`, `created_at` | | como na inscrição de hoje |

- RLS ligado sem política, como hoje.

A coluna `empresa` do participante **não** é a empresa cliente: a planilha do cliente traz empresas
diferentes por pessoa. A importação deixa de criar linhas em `empresas`.

## 2. Telas e navegação

- Menu lateral: **Empresas**, **Eventos**, **Check-in**. Saem do menu "Participantes" e "Importar
  planilha"; as rotas globais `/participantes/**` e `/eventos/[id]/inscrever` deixam de existir
  (não há mais cadastro fora do evento para "inscrever").
- `/empresas/[id]`: dados da empresa + lista dos eventos dela (mais recente primeiro) + "Novo evento"
  (`/eventos/novo?empresa=<id>`, empresa pré-selecionada).
- Formulário de evento: campo **empresa** obrigatório (seleção).
- `/eventos`: lista com a coluna empresa.
- `/eventos/[id]`: cabeçalho com empresa, evento, tipo e data; resumo de presença (já existe);
  tabela de participantes; ações **Adicionar participante**, **Importar planilha**, **Exportar CSV**,
  **Baixar PDFs (ZIP)**, editar e apagar evento; e-mail como hoje (parado).
- Participante: `/eventos/[id]/participantes/novo` e `/eventos/[id]/participantes/[pid]` (editar,
  remover, baixar o PDF).
- Importação: `/eventos/[id]/importar`; o modelo de planilha continua com as mesmas colunas.
- Check-in: igual; lê o `codigo` em `participantes`. O status "de outro evento" continua.
- Breadcrumb e item ativo do menu acompanham as rotas novas.

## 3. CSV do evento

Rota `GET /eventos/[id]/csv`, baixa `<nome-do-evento>.csv`. Uma linha por participante, em ordem de
nome. Colunas, nesta ordem:

`empresa; evento; tipo_evento; data_evento; nome; documento; data_nascimento; email; telefone;
empresa_participante; tipo; compareceu; chegada`

- `compareceu`: `Sim` / `Não`. `chegada`: `dd/mm/aaaa hh:mm` no fuso `America/Sao_Paulo`, vazio se
  não veio. Datas `dd/mm/aaaa`. Tipos pelo rótulo legível ("Premiação e incentivo", "VIP").
- Separador `;`, quebra `\r\n`, UTF-8 **com BOM** — é o que o Excel brasileiro abre sem estragar
  acento nem juntar colunas.
- Aspas: campo com `;`, `"` ou quebra de linha vai entre aspas, com `"` dobrada.
- Injeção de fórmula: célula que começa com `=`, `+`, `-`, `@`, tab ou CR ganha `'` na frente.
- Evento sem participantes: CSV só com o cabeçalho (não é erro).

A montagem é uma função pura em `src/lib/` (dados → texto), testada sem banco.

## 4. Credencial em PDF

A4, de cima para baixo:

1. Nome da **empresa cliente**, em caixa alta, pequeno e espaçado.
2. Nome do evento (negrito) e, abaixo, `<tipo do evento> · <dd/mm/aaaa>`.
3. QR do código e, logo abaixo, o **código impresso** em fonte legível, para digitar no check-in.
4. Nome do participante (grande), tipo em caixa alta, empresa do participante se houver.
5. `Credencial pessoal e intransferível. Apresente este QR code na entrada do evento.`
6. Filete horizontal e o rodapé
   `© <ano do evento> <Empresa cliente> · Organização VM Events. Todos os direitos reservados.`

O ano sai da data do evento (evento de 2026 → "2026"). Texto comprido diminui até caber, como hoje;
caractere fora do WinAnsi segue a regra de `textoSeguro`. `DadosCredencial` ganha `empresaCliente`,
`tipoEvento` e `ano`; `empresa` passa a ser a do participante.

## 5. Importação de planilha

Causa do erro relatado, medida em 2026-10-06:

- **No PC**, a planilha do autor (10 linhas) é lida sem falha; 7 linhas caem em "Tipo inválido" porque
  usam "Organizador" e "Padrão". Resolvido pela decisão 3 — fora do código.
- **No celular**, a página inteira vira "This page couldn't load". Não reproduzido aqui. Causa
  provável: no Android, o arquivo escolhido (WhatsApp, Drive) deixa de ser legível quando a Server
  Action o envia, a promessa rejeita, e `importador.tsx` não trata rejeição — sobe para o error
  boundary. O fluxo envia o arquivo duas vezes (prévia e gravação), dobrando a chance.

Mudanças:

- Ao escolher o arquivo, o cliente lê os bytes para a memória (`await file.arrayBuffer()`) e passa a
  enviar essa cópia nas duas chamadas. Falha na leitura vira aviso "Não consegui abrir o arquivo.
  Escolha de novo." e limpa o campo.
- `previsualizar` e `importar` no cliente ficam em `try/catch`: rejeição vira `toast.error("Falha ao
  falar com o servidor. Tente de novo.")` e a página continua de pé.
- No servidor, a consulta de documentos existentes da prévia fica dentro de tratamento de erro e
  devolve `{ ok: false, mensagem }`.
- `decodificarTexto` reconhece BOM UTF-16 (`FF FE` / `FE FF`) — o "Texto Unicode" do Excel, que hoje
  vira planilha vazia.
- Grava em `participantes` do evento da rota, `upsert` por `(evento_id, documento)`: reimportar
  atualiza quem já está no evento e mantém o código e o check-in. O seletor "inscrever no evento"
  some — o evento é o da página.
- A prévia conta "novos" e "já no evento" consultando só o evento da rota.

## 6. Testes

- Unidade: montagem do CSV (BOM, separador, aspas, fórmula, Sim/Não, fuso da chegada); PDF com os
  campos novos (o texto aparece no arquivo); `lerPlanilha` com UTF-16LE com BOM; `previsualizar`
  resolvendo `{ ok: false }` quando o banco lança; navegação/breadcrumb das rotas novas.
- Ponta a ponta (`e2e/fluxo.spec.ts`) reescrito no fluxo novo: cria empresa → evento → adiciona e
  importa participantes → check-in → baixa o CSV e confere `Sim` e a hora de chegada.
- Celular: o autor confirma a importação no próprio aparelho, no preview da PR.
