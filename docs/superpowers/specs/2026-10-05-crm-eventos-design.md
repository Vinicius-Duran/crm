# CRM de eventos — design

Data: 2026-10-05 · Status: aprovada pelo autor · Plano: `docs/superpowers/plans/2026-10-05-crm-eventos.md`

## Objetivo

Cadastrar participantes e eventos, gerar para cada inscrição um PDF com QR code,
enviá-lo ao participante e, no dia, ler o QR para registrar presença e liberar a
entrega do crachá.

## Decisões do autor

| # | decisão | observação |
| --- | --- | --- |
| 1 | **Um login só**, pela proteção de deployment da própria Vercel. O sistema não tem tela de login. | Recomendação era Basic Auth com 5 usuários. Consequência aceita: o check-in **não** registra quem leu o QR, só quando. |
| 2 | **QR com código aleatório por inscrição** (participante × evento). | Chegou a escolher HMAC do CPF e trocou. O código por inscrição já diz o evento — dispensa escolher evento antes de ler. |
| 3 | **Participante pode estar em vários eventos**; check-in é por inscrição. | Consequência da decisão 2. |
| 4 | **PDF: baixar e enviar por e-mail.** No começo o envio é manual; o automático já fica pronto. | O botão de e-mail fica desligado, com explicação, até existirem a chave do Resend e o domínio. |
| 5 | **Entrada de dados por formulário e por planilha** (CSV/Excel). | |
| 6 | **Next.js na Vercel, Supabase acessado só pelo servidor.** | A proteção da Vercel tranca as páginas, não a API do Supabase — a chave nunca vai ao navegador. |
| 7 | **MCP do Supabase instalado no projeto** (`.mcp.json`) para o agente aplicar migrações. | Pedido do autor. Falta autenticar (`/mcp`) e fixar o `project_ref` depois de o projeto existir. |

## Fora de escopo

Login por pessoa e auditoria de quem fez o quê · CNPJ e endereço de empresa ·
histórico de alterações · desfazer check-in pela interface · impressão de
crachá pelo sistema · página pública para o participante.

## Dados

| tabela | campos | regras |
| --- | --- | --- |
| `empresas` | `id`, `nome`, `created_at` | `nome` único sem diferenciar caixa (índice em `lower(nome)`). |
| `participantes` | `id`, `nome`, `documento`, `data_nascimento`, `email`, `telefone`, `empresa_id` (opcional), `tipo`, `created_at` | `documento` guardado só com dígitos/letras, sem pontuação, e único. `tipo` ∈ {palestrante, vip, autoridade, convidado}. FK para `empresas` com `on delete restrict`. |
| `eventos` | `id`, `nome`, `tipo`, `data`, `created_at` | `tipo` ∈ {palestra, workshop, treinamento, kickoff, lancamento, premiacao_incentivo, demonstracao_produto, feedback}. `data` foi acréscimo meu, aprovado. |
| `inscricoes` | `id`, `participante_id`, `evento_id`, `codigo`, `checkin_em`, `email_enviado_em`, `email_erro`, `created_at` | `unique(participante_id, evento_id)`. `codigo` único. FK para participante com `on delete cascade`; para evento com `on delete cascade`. |

- **Documento:** com 11 dígitos é tratado como CPF e os dígitos verificadores
  são conferidos; fora disso é aceito como veio (passaporte de autoridade
  estrangeira).
- **Código do QR:** `crypto.randomBytes(16).toString('base64url')` — 128 bits,
  22 caracteres. O QR contém **só** o código, sem URL.
- **Busca:** nome comparado sem acento e sem caixa, documento comparado só por
  dígitos. *Ajuste do plano:* em vez da extensão `unaccent`, a coluna
  `participantes.nome_busca` é preenchida pelo app com a mesma normalização. O
  resultado é igual, e a regra fica testável no Vitest.
- **RLS ligado sem políticas** nas quatro tabelas: o acesso público pela API do
  Supabase fica bloqueado; só o servidor, com a chave `service_role`, acessa.

## Telas

**Participantes** — lista com busca única (nome ou CPF) e filtros por empresa e
tipo; criar, editar, apagar.

**Importar planilha** — modelo para baixar com as colunas `nome, documento,
data_nascimento, email, telefone, empresa, tipo`. Fluxo: enviar → prévia em três
grupos (novos, existentes, com erro) → confirmar. Empresa vem pelo nome e é
criada se não existir. Documento existente **atualiza** o cadastro. Linha com
erro não grava e não bloqueia as outras; o relatório diz linha a linha o motivo.
Opcionalmente escolhe-se um evento e todos os importados já saem inscritos.

**Empresas** — lista, busca, criar, editar, apagar (bloqueado se houver
participante).

**Eventos** — lista por data; criar, editar, apagar. Página do evento: inscritos,
contagem presentes/inscritos, adicionar e remover participantes, baixar PDF de
um, baixar ZIP do evento (um arquivo por pessoa, nomeado pelo nome), enviar
e-mail para um ou para todos ainda não enviados, com progresso.

**PDF** — A4: nome em destaque, tipo, empresa, nome e data do evento, QR grande.

**Check-in** — tela para celular, câmera aberta direto. Cada leitura mostra:

- 🟢 check-in feito agora — nome, tipo, empresa, "entregar crachá";
- 🟡 já fez check-in — com o horário;
- 🔴 código desconhecido, ou de outro evento (com o nome do evento certo).

Busca manual por nome/CPF com botão de check-in, para quem chega sem QR legível.
Seletor de evento no topo: filtra a busca manual e define o que é "outro evento".

## Arquitetura

| peça | escolha |
| --- | --- |
| app | Next.js (App Router) + TypeScript, hospedado na Vercel |
| banco | Supabase Postgres; cliente só em módulos `server-only` |
| migrações | SQL em `supabase/migrations/`, aplicadas pelo MCP do Supabase |
| PDF / QR | `pdf-lib` + `qrcode`, gerados no servidor |
| ZIP | `fflate` |
| planilha | SheetJS (CSV e Excel) |
| leitor de QR | `qr-scanner` (funciona no Safari do iPhone) |
| e-mail | Resend, opcional |
| visual | Tailwind + shadcn/ui |

Versões e APIs de cada biblioteca são conferidas na documentação ao escrever o
plano, não de memória.

**Variáveis de ambiente:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY` (opcional), `EMAIL_FROM` (opcional). Sem as duas últimas o
envio de e-mail aparece desligado.

## Erros

- Validação aparece no campo. Violação de unicidade vira mensagem legível
  ("documento já cadastrado para Fulano"), não erro do banco.
- **Check-in concorrente:** `update inscricoes set checkin_em = now() where
  codigo = $1 and checkin_em is null returning *`. Sem linha de volta, consulta
  e mostra amarelo (já feito) ou vermelho (não existe). Dois celulares no mesmo
  QR dão um verde e um amarelo, nunca dois verdes.
- **E-mail em lote:** falha de um envio grava `email_erro` naquela inscrição e o
  lote segue. O plano grátis do Resend limita a 100 e-mails por dia; o sistema
  envia em levas e mostra quantos faltam.

## Testes

- **Vitest** para lógica pura: validação de CPF, normalização de documento e
  nome, leitura e validação da planilha, geração do código.
- **Playwright** no fluxo inteiro: cadastrar, importar, gerar PDF, ler o QR
  (verde), ler de novo (amarelo), código inválido (vermelho), em 1440 e 390 de
  largura.

## Front-end

Todo trabalho visual segue as cinco skills obrigatórias do autor, nesta ordem:
taste-skill, refero, emil-design-eng, impeccable, 21st.dev. Animação, quando
houver, por GSAP/anime.js, só em `transform`/`opacity`. Nada pronto sem
screenshot do Playwright.

## Passos que dependem do autor

1. Criar o projeto no Supabase. O agente então fixa o `project_ref` no
   `.mcp.json`, e o autor autentica o MCP com `/mcp` → supabase → Authenticate.
2. Criar o projeto na Vercel ligado ao repositório e preencher as variáveis.
3. Ligar a proteção em *Vercel → Settings → Deployment Protection*.
   **Corrigido em 2026-10-05**, depois de conferir a documentação da Vercel
   (atualizada em set/2026). A versão anterior desta spec dizia que o Hobby só
   protegia os previews, e isso estava errado:
   - **Vercel Authentication com "All Deployments"** protege também o domínio de
     produção, **em qualquer plano**, inclusive o Hobby. Entra quem estiver logado
     numa conta Vercel com acesso ao projeto.
   - **Password Protection**, a senha única, é do plano Pro, a US$ 20/mês por
     projeto.
   - **"Standard Protection"** não protege o domínio de produção.

   Qual das duas usar é decisão do autor, e está em aberto.
4. Para e-mail automático: conta no Resend e domínio verificado.
